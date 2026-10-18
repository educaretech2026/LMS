import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

const ALLOWED_MIME_PREFIXES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-',
  'text/plain',
  'text/csv',
];

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
  '.png': ['image/png', 'image/jpeg'],
  '.webp': ['image/webp', 'image/jpeg'],
  '.gif': ['image/gif', 'image/jpeg'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime', 'video/mp4'],
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.m4a': ['audio/mp4', 'audio/x-m4a'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
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
   * Generates a pre-signed URL for client-side direct uploads.
   * Validates file extension, mime type, and cross-compatibility.
   */
  async getPresignedUploadUrl(filename: string, contentType: string) {
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

    const isAllowedMime = ALLOWED_MIME_PREFIXES.some(prefix =>
      contentType.toLowerCase().startsWith(prefix)
    );
    if (!isAllowedMime) {
      throw new BadRequestException(`Content-Type "${contentType}" is not permitted.`);
    }

    const expectedMimes = EXTENSION_FAMILY_MIME_MAP[ext];
    if (expectedMimes) {
      const lowerMime = contentType.toLowerCase();
      const isCompatible = expectedMimes.some(m => lowerMime === m || lowerMime.startsWith(m));
      if (!isCompatible) {
        throw new BadRequestException(`Content-Type "${contentType}" is incompatible with file extension "${ext}".`);
      }
    }

    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      throw new HttpException('Storage is not configured on the server.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const uniqueId = crypto.randomBytes(16).toString('hex');
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `materials/${Date.now()}-${uniqueId}-${safeFilename}`;

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

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
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
   * Deletes a file from R2.
   * @param objectKey The key of the object in R2
   */
  async deleteFile(objectKey: string) {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      return; // Skip if storage not configured
    }

    try {
      // If it's a full URL, extract the object key
      let key = objectKey;
      if (key && key.startsWith('http')) {
        const parts = key.split('/');
        key = parts.slice(3).join('/');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error: any) {
      console.error('Error deleting file from R2:', error);
      // We don't throw an error here to prevent blocking database deletion
    }
  }
}
