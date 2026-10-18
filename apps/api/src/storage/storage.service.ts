import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.mp4', '.webm', '.mov',
  '.mp3', '.wav', '.m4a',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv',
]);

const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.phtm', '.phps',
  '.js', '.mjs', '.cjs', '.jsp', '.asp', '.aspx', '.cgi', '.py', '.pl',
  '.html', '.htm', '.xhtml', '.svg', '.svgz', '.vbs', '.scr', '.msi',
  '.jar', '.com', '.hta', '.wsf', '.dll',
]);


const EXTENSION_FAMILY_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.m4a': ['audio/mp4', 'audio/x-m4a'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv'],
};

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'educare-materials';
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || '';
    
    if (this.publicUrl && !this.publicUrl.startsWith('http')) {
      this.publicUrl = `https://${this.publicUrl}`;
    }

    if (!accountId || !accessKeyId || !secretAccessKey) {
      console.warn('⚠️ Cloudflare R2 credentials are not fully configured. File uploads will fail.');
      // Initialize with dummy values so the app doesn't crash on startup, but throw when used.
      this.s3Client = new S3Client({ region: 'auto' });
    } else {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  /**
   * Validates and extracts a canonical managed object key from an object key or URL.
   * Prevents arbitrary deletion of unowned or external objects, and rejects path traversal.
   */
  extractAndValidateObjectKey(urlOrKey: string): string | null {
    if (!urlOrKey || typeof urlOrKey !== 'string') {
      return null;
    }

    let rawKey = urlOrKey.trim();
    if (!rawKey) return null;

    if (rawKey.startsWith('http://') || rawKey.startsWith('https://')) {
      try {
        const parsedUrl = new URL(rawKey);
        const allowedHosts: string[] = [];
        if (this.publicUrl) {
          try {
            allowedHosts.push(new URL(this.publicUrl).host.toLowerCase());
          } catch {
            // ignore
          }
        }
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        if (accountId) {
          allowedHosts.push(`${accountId.toLowerCase()}.r2.cloudflarestorage.com`);
        }

        const urlHost = parsedUrl.host.toLowerCase();
        const isAllowedHost = allowedHosts.length > 0 && allowedHosts.some(h => urlHost === h || urlHost.endsWith(`.${h}`));
        if (!isAllowedHost) {
          return null;
        }

        rawKey = parsedUrl.pathname.replace(/^\/+/, '');
      } catch {
        return null;
      }
    } else {
      rawKey = rawKey.replace(/^\/+/, '');
    }

    // Path traversal rejection
    if (rawKey.includes('..') || rawKey.includes('\\')) {
      return null;
    }

    // Must be in managed storage prefixes: 'materials/', 'forms/', or 'thumbnails/'
    if (!rawKey.startsWith('materials/') && !rawKey.startsWith('forms/') && !rawKey.startsWith('thumbnails/')) {
      return null;
    }

    // Strict character whitelist for object keys
    if (!/^[a-zA-Z0-9_\-\./]+$/.test(rawKey)) {
      return null;
    }

    return rawKey;
  }

  /**
   * Extracts the owning userId from an object key if it was generated with user scoping.
   */
  extractOwnerFromKey(objectKey: string): string | null {
    const validated = this.extractAndValidateObjectKey(objectKey);
    if (!validated) return null;
    const parts = validated.split('/');
    if (parts.length >= 3 && (parts[0] === 'materials' || parts[0] === 'thumbnails')) {
      return parts[1];
    }
    return null;
  }

  /**
   * Generates a pre-signed URL for client-side direct uploads.
   * Validates file extension, mime type, and cross-compatibility.
   * Scopes objectKey to requesting user when userId is provided.
   */
  async getPresignedUploadUrl(filename: string, contentType: string, userId?: string) {
    if (!filename || !contentType) {
      throw new BadRequestException('Filename and contentType are required.');
    }

    if (filename.length > 255) {
      throw new BadRequestException('Filename must not exceed 255 characters.');
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext) || DISALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`File extension "${ext}" is not permitted.`);
    }

    // Normalize Content-Type, stripping parameters like charset
    const baseMime = contentType.split(';')[0].trim().toLowerCase();
    if (!baseMime || !ALLOWED_MIMES.has(baseMime)) {
      throw new BadRequestException(`Content-Type "${contentType}" is not permitted.`);
    }

    const expectedMimes = EXTENSION_FAMILY_MIME_MAP[ext];
    if (expectedMimes) {
      if (!expectedMimes.includes(baseMime)) {
        throw new BadRequestException(`Content-Type "${contentType}" is incompatible with file extension "${ext}".`);
      }
    }

    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      throw new HttpException('Storage is not configured on the server.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const uniqueId = crypto.randomBytes(16).toString('hex');
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const safeUserId = userId ? String(userId).replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const objectKey = safeUserId 
      ? `materials/${safeUserId}/${Date.now()}-${uniqueId}-${safeFilename}`
      : `materials/${Date.now()}-${uniqueId}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    try {
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      const finalUrl = `${this.publicUrl}/${objectKey}`;
      return { uploadUrl, finalUrl, objectKey };
    } catch (error: any) {
      console.error('Error generating pre-signed URL:', error);
      throw new HttpException('Failed to generate upload URL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generates a pre-signed GET URL for secure video streaming/downloading.
   * @param objectKey The key of the object in R2
   * @param expiresIn Seconds until the link expires
   */
  async getPresignedDownloadUrl(objectKey: string, expiresIn: number = 7200) {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      throw new HttpException('Storage is not configured on the server.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const validatedKey = this.extractAndValidateObjectKey(objectKey);
    if (!validatedKey) {
      throw new BadRequestException('Invalid or unmanaged storage object key.');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: validatedKey,
    });

    try {
      const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return { downloadUrl };
    } catch (error: any) {
      console.error('Error generating pre-signed GET URL:', error);
      throw new HttpException('Failed to generate download URL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Deletes a file from R2 after verifying that it is an authorized managed object key.
   * Rejects external URLs, unexpected hosts, path manipulation, and unmanaged keys.
   * @param objectKey The key or URL of the object in R2
   */
  async deleteFile(objectKey: string): Promise<boolean> {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      return false; // Skip if storage not configured
    }

    const validatedKey = this.extractAndValidateObjectKey(objectKey);
    if (!validatedKey) {
      console.warn(`[StorageService] Refusing to delete unmanaged or invalid storage object: ${objectKey}`);
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: validatedKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      console.error('Error deleting file from R2:', error);
      return false;
    }
  }
}
