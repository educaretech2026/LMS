import { Injectable, HttpException, HttpStatus, BadRequestException, ForbiddenException, InternalServerErrorException, Optional } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, assertCentreAccess } from '../common/utils/tenant.util';
import * as crypto from 'crypto';
import * as path from 'path';
import { cleanEnvValue, loadEnv } from '../common/config/env.loader';

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
  private s3Client!: S3Client;
  private bucketName: string = 'educare';
  private publicUrl: string = '';
  private currentAccountId: string = '';
  private currentAccessKeyId: string = '';

  constructor(@Optional() private prisma?: PrismaService) {
    this.getClient();
  }

  /**
   * Dynamically retrieves normalized and sanitized Cloudflare R2 configuration.
   * Supports standard environment variable names as well as common alias formats.
   */
  public getConfig() {
    const accountId = cleanEnvValue(
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
      process.env.R2_ACCOUNT_ID
    );
    const accessKeyId = cleanEnvValue(
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      process.env.R2_ACCESS_KEY_ID ||
      process.env.CLOUDFLARE_ACCESS_KEY_ID
    );
    const secretAccessKey = cleanEnvValue(
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.CLOUDFLARE_SECRET_ACCESS_KEY
    );
    const bucketName = cleanEnvValue(
      process.env.CLOUDFLARE_R2_BUCKET_NAME ||
      process.env.R2_BUCKET_NAME ||
      process.env.CLOUDFLARE_BUCKET_NAME ||
      this.bucketName ||
      'educare'
    );
    let publicUrl = cleanEnvValue(
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
      process.env.R2_PUBLIC_DOMAIN ||
      process.env.CLOUDFLARE_PUBLIC_DOMAIN ||
      this.publicUrl ||
      ''
    );

    if (publicUrl && !publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
      publicUrl = `https://${publicUrl}`;
    }
    publicUrl = publicUrl.replace(/\/+$/, '');

    const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey);
    return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, isConfigured };
  }

  /**
   * Returns or lazily instantiates the S3Client connected to Cloudflare R2.
   */
  public getClient(): S3Client {
    const config = this.getConfig();
    if (config.isConfigured) {
      if (
        !this.s3Client ||
        this.currentAccountId !== config.accountId ||
        this.currentAccessKeyId !== config.accessKeyId
      ) {
        this.currentAccountId = config.accountId;
        this.currentAccessKeyId = config.accessKeyId;
        this.bucketName = config.bucketName;
        this.publicUrl = config.publicUrl;
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        });
      }
      return this.s3Client;
    }

    if (!this.s3Client) {
      this.s3Client = new S3Client({ region: 'auto' });
    }
    return this.s3Client;
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
        const config = this.getConfig();

        if (config.publicUrl) {
          try {
            allowedHosts.push(new URL(config.publicUrl).host.toLowerCase());
          } catch {
            // ignore
          }
        }
        if (config.accountId) {
          allowedHosts.push(`${config.accountId.toLowerCase()}.r2.cloudflarestorage.com`);
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
   * Enforces server-side controlled namespaces (materials, forms, thumbnails).
   */
  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    userId?: string,
    options?: { prefix?: 'materials' | 'forms' | 'thumbnails'; scopeId?: string; maxSizeBytes?: number }
  ) {
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

    let config = this.getConfig();
    if (!config.isConfigured) {
      loadEnv();
      config = this.getConfig();
    }
    if (!config.isConfigured) {
      const missing: string[] = [];
      if (!config.accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
      if (!config.accessKeyId) missing.push('CLOUDFLARE_R2_ACCESS_KEY_ID');
      if (!config.secretAccessKey) missing.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

      throw new HttpException(
        `Storage is not configured on the server. Missing: ${missing.join(', ')}. Please ensure these are set in .env on the backend server and that the backend API process is restarted.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let objectKey: string;
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');

    let prefix: 'materials' | 'forms' | 'thumbnails' = options?.prefix || 'materials';
    let scope = '';

    if (options?.prefix) {
      prefix = options.prefix;
      if (prefix === 'forms' && options.scopeId) {
        scope = String(options.scopeId).replace(/[^a-zA-Z0-9_-]/g, '');
      } else if (typeof userId === 'string' && userId) {
        scope = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
      }
    } else {
      // If options not explicitly passed, maintain compatibility with internal callers/tests
      // but only if filename explicitly indicated forms/ or thumbnails/
      if (filename.startsWith('forms/')) {
        prefix = 'forms';
        const parts = filename.split('/');
        if (parts.length >= 2 && parts[1]) {
          scope = parts[1].replace(/[^a-zA-Z0-9_-]/g, '');
        }
      } else if (filename.startsWith('thumbnails/')) {
        prefix = 'thumbnails';
        if (typeof userId === 'string' && userId) {
          scope = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
        }
      } else {
        prefix = 'materials';
        if (typeof userId === 'string' && userId) {
          scope = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
        }
      }
    }

    if (prefix === 'forms') {
      objectKey = scope 
        ? `forms/${scope}/${Date.now()}-${uniqueId}-${safeFilename}`
        : `forms/${Date.now()}-${uniqueId}-${safeFilename}`;
    } else if (prefix === 'thumbnails') {
      objectKey = scope 
        ? `thumbnails/${scope}/${Date.now()}-${uniqueId}-${safeFilename}`
        : `thumbnails/${Date.now()}-${uniqueId}-${safeFilename}`;
    } else {
      objectKey = scope 
        ? `materials/${scope}/${Date.now()}-${uniqueId}-${safeFilename}`
        : `materials/${Date.now()}-${uniqueId}-${safeFilename}`;
    }

    const maxSizeBytes = options?.maxSizeBytes || (
      prefix === 'materials'
        ? 100 * 1024 * 1024 // 100 MB for docs
        : (prefix === 'forms' ? 25 * 1024 * 1024 : 20 * 1024 * 1024) // 20 MB for thumbnails
    );

    const expiresIn = 900; // 15-minute short expiry for presigned upload URLs

    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    try {
      const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn });
      const finalUrl = config.publicUrl
        ? `${config.publicUrl}/${objectKey}`
        : `https://${config.bucketName}.r2.cloudflarestorage.com/${objectKey}`;
      return { uploadUrl, finalUrl, objectKey, maxSizeBytes, expiresIn };
    } catch (error: any) {
      console.error('Error generating pre-signed URL:', error);
      throw new HttpException('Failed to generate upload URL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Directly uploads a Buffer to Cloudflare R2 bucket.
   * Useful for admission photographs, signatures, and server-side asset processing.
   */
  async uploadDirect(
    buffer: Buffer,
    contentType: string,
    prefix: string = 'admissions',
    customFilename?: string,
  ): Promise<{ finalUrl: string; objectKey: string } | null> {
    const config = this.getConfig();
    if (!config.isConfigured) {
      console.warn('[StorageService] Storage is not configured; skipping direct upload to R2.');
      return null;
    }

    const uniqueId = crypto.randomUUID();
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : 'bin';

    const cleanName = customFilename
      ? customFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
      : `file-${Date.now()}-${uniqueId}.${ext}`;

    const objectKey = `${prefix.replace(/^\/+|\/+$/g, '')}/${cleanName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      });

      await this.getClient().send(command);

      const finalUrl = config.publicUrl
        ? `${config.publicUrl}/${objectKey}`
        : `https://${config.bucketName}.r2.cloudflarestorage.com/${objectKey}`;

      return { finalUrl, objectKey };
    } catch (error: any) {
      console.error('[StorageService] Error during direct R2 upload:', error?.message);
      return null;
    }
  }

  /**
   * Directly uploads a base64 Data URL or raw base64 string to Cloudflare R2 bucket.
   */
  async uploadBase64(
    dataUrlOrBase64: string,
    prefix: string = 'admissions',
    filenamePrefix: string = 'asset',
  ): Promise<{ finalUrl: string; objectKey: string } | null> {
    if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') return null;

    let contentType = 'image/png';
    let base64String = dataUrlOrBase64;

    const match = dataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      contentType = match[1];
      base64String = match[2];
    }

    try {
      const buffer = Buffer.from(base64String, 'base64');
      const ext = contentType.includes('jpeg') || contentType.includes('jpg')
        ? 'jpg'
        : contentType.includes('webp')
        ? 'webp'
        : 'png';
      const filename = `${filenamePrefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      return await this.uploadDirect(buffer, contentType, prefix, filename);
    } catch (err: any) {
      console.error('[StorageService] Error uploading base64 to R2:', err?.message);
      return null;
    }
  }

  /**
   * Generates a pre-signed GET URL for secure video streaming/downloading.
   * @param objectKey The key of the object in R2
   * @param expiresIn Seconds until the link expires
   */
  async getPresignedDownloadUrl(objectKey: string, expiresIn: number = 7200) {
    const config = this.getConfig();
    if (!config.isConfigured) {
      throw new HttpException('Storage is not configured on the server.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const validatedKey = this.extractAndValidateObjectKey(objectKey);
    if (!validatedKey) {
      throw new BadRequestException('Invalid or unmanaged storage object key.');
    }

    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: validatedKey,
    });

    try {
      const downloadUrl = await getSignedUrl(this.getClient(), command, { expiresIn });
      return { downloadUrl };
    } catch (error: any) {
      console.error('Error generating pre-signed GET URL:', error);
      throw new HttpException('Failed to generate download URL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Validates the actual size of an uploaded object directly against Cloudflare R2 / S3 via HeadObject.
   * If the object exceeds the allowed quota, it is immediately purged from storage and rejected.
   */
  async validateAndEnforceObjectSize(
    urlOrKey: string,
    customMaxSizeBytes?: number
  ): Promise<{ valid: boolean; actualSizeBytes: number }> {
    const config = this.getConfig();
    if (!config.isConfigured) {
      throw new BadRequestException('Storage service is not configured to verify uploaded file size.');
    }

    const validatedKey = this.extractAndValidateObjectKey(urlOrKey);
    if (!validatedKey) {
      throw new BadRequestException('Invalid or unmanaged storage object.');
    }

    let maxSizeBytes = customMaxSizeBytes;
    if (!maxSizeBytes) {
      if (validatedKey.startsWith('materials/')) {
        maxSizeBytes = 100 * 1024 * 1024; // 100 MB for docs
      } else if (validatedKey.startsWith('forms/')) {
        maxSizeBytes = 25 * 1024 * 1024; // Default 25 MB for forms
      } else {
        maxSizeBytes = 20 * 1024 * 1024; // 20 MB for thumbnails
      }
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: validatedKey,
      });

      const head = await this.getClient().send(command);
      const actualSizeBytes = head.ContentLength || 0;

      if (actualSizeBytes > maxSizeBytes) {
        // Never bypass reference checks! Only delete unreferenced uploads
        const inUse = await this.isStorageUrlInUse(validatedKey);
        let purged = false;
        if (!inUse) {
          purged = await this.deleteFile(validatedKey, false);
        }
        const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
        const actualMB = (actualSizeBytes / (1024 * 1024)).toFixed(1);
        throw new BadRequestException(
          `Uploaded file size (${actualMB}MB) exceeds the maximum allowed limit of ${maxMB}MB.${purged ? ' The oversized object has been purged from storage.' : ' Deletion was skipped or failed, and attachment is rejected.'}`
        );
      }

      return { valid: true, actualSizeBytes };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        throw new BadRequestException('Uploaded object does not exist in storage.');
      }
      console.error('Error inspecting object size in R2 (failing closed):', err);
      throw new BadRequestException('Failed to verify uploaded object size. Storage verification failed closed.');
    }
  }

  /**
   * Finalizes and verifies an upload before resource attachment.
   * - Fails closed: authenticated user context is strictly required.
   * - Enforces server-defined size limit policy (clients cannot specify limit).
   * - Authenticates upload ownership: requires owner-bearing key for ordinary uploads;
   *   rejects unscoped/legacy keys for non-Super Admins.
   * - Fails closed on database availability for form authorizations.
   * - Never bypasses reference checks: referenced objects are never deleted.
   */
  async finalizeUpload(urlOrKey: string, user: any) {
    if (!urlOrKey || typeof urlOrKey !== 'string') {
      throw new BadRequestException('Storage object key is required.');
    }
    const validatedKey = this.extractAndValidateObjectKey(urlOrKey);
    if (!validatedKey) {
      throw new BadRequestException('Invalid or unmanaged storage object.');
    }

    // Fail closed: authenticated user context is strictly required
    if (!user || !user.id) {
      throw new ForbiddenException('Authenticated user is required to finalize uploads.');
    }

    // Authenticate upload ownership
    if (!isSuperAdmin(user)) {
      if (validatedKey.startsWith('materials/') || validatedKey.startsWith('thumbnails/')) {
        const ownerId = this.extractOwnerFromKey(validatedKey);
        if (!ownerId) {
          throw new ForbiddenException('Access denied: Upload key lacks required owner scoping.');
        }
        if (ownerId !== user.id) {
          throw new ForbiddenException('Access denied: You can only finalize your own uploads.');
        }
      } else if (validatedKey.startsWith('forms/')) {
        if (!this.prisma) {
          throw new InternalServerErrorException('Database service is unavailable for form authorization.');
        }
        const parts = validatedKey.split('/');
        const formId = parts[1];
        if (parts.length < 3 || !formId) {
          throw new BadRequestException('Form upload key must contain a valid form identifier.');
        }
        const form = await (this.prisma as any).customForm?.findUnique?.({ where: { id: formId } });
        if (!form) {
          throw new BadRequestException('Referenced form does not exist.');
        }
        if (form.centreId) {
          assertCentreAccess(user, form.centreId);
        } else {
          throw new ForbiddenException('Only super administrators can manage global form uploads.');
        }
      }
    }

    // Server-enforced size limit policy (no client tampering)
    let serverLimit: number;
    if (validatedKey.startsWith('materials/')) {
      serverLimit = 100 * 1024 * 1024; // 100 MB
    } else if (validatedKey.startsWith('forms/')) {
      if (!this.prisma) {
        throw new InternalServerErrorException('Database service is unavailable for form authorization.');
      }
      let customLimit = 25 * 1024 * 1024;
      const parts = validatedKey.split('/');
      const formId = parts[1];
      if (parts.length < 3 || !formId) {
        throw new BadRequestException('Form upload key must contain a valid form identifier.');
      }
      const form = await (this.prisma as any).customForm?.findUnique?.({ where: { id: formId } });
      if (!form) {
        throw new BadRequestException('Referenced form does not exist.');
      }
      if (form?.maxFileSizeBytes) customLimit = form.maxFileSizeBytes;
      serverLimit = customLimit;
    } else {
      serverLimit = 20 * 1024 * 1024; // 20 MB for thumbnails
    }

    const validated = await this.validateAndEnforceObjectSize(validatedKey, serverLimit);
    return {
      verified: true,
      objectKey: validatedKey,
      sizeBytes: validated.actualSizeBytes,
    };
  }

  /**
   * Scans storage for unreferenced orphan objects older than the retention threshold (default 2 hours)
   * and purges them safely after verifying that no application records reference them.
   * Implements full ContinuationToken pagination across result sets.
   */
  async cleanupOrphanUploads(maxAgeHours: number = 2, maxObjectsPerPrefix: number = 1000): Promise<{ scanned: number; purged: number }> {
    if (!Number.isFinite(maxAgeHours) || maxAgeHours < 1 || maxAgeHours > 720) {
      throw new BadRequestException('maxAgeHours must be a finite number between 1 and 720 hours (minimum 1 hour retention).');
    }

    const config = this.getConfig();
    if (!config.isConfigured || !this.prisma) {
      return { scanned: 0, purged: 0 };
    }

    try {
      const thresholdTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
      let purgedCount = 0;
      let scannedCount = 0;

      const prefixes = ['materials/', 'thumbnails/', 'forms/'];
      for (const prefix of prefixes) {
        let continuationToken: string | undefined = undefined;
        let prefixScanned = 0;

        do {
          const listCmd: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: prefix,
            MaxKeys: 100,
            ContinuationToken: continuationToken,
          });

          const listRes = await this.getClient().send(listCmd);
          const contents = listRes.Contents || [];
          for (const item of contents) {
            if (!item.Key || !item.LastModified) continue;
            scannedCount++;
            prefixScanned++;
            if (item.LastModified.getTime() < thresholdTime) {
              const inUse = await this.isStorageUrlInUse(item.Key);
              if (!inUse) {
                const deleted = await this.deleteFile(item.Key, false);
                if (deleted) purgedCount++;
              }
            }
          }

          continuationToken = listRes.IsTruncated && listRes.NextContinuationToken
            ? listRes.NextContinuationToken
            : undefined;
        } while (continuationToken && prefixScanned < maxObjectsPerPrefix);
      }

      return { scanned: scannedCount, purged: purgedCount };
    } catch (err) {
      console.error('Error during orphan upload cleanup:', err);
      return { scanned: 0, purged: 0 };
    }
  }

  /**
   * Authoritative check across ALL application models to verify if a storage URL or key is referenced.
   * Checks: studyMaterial, mcqQuestion, studentAnswer, customFormResponse, customForm (fields), user, notice, supportTicket, assignment, doubt.
   * Fails closed: if database access is absent or any query fails, returns true (object in use).
   */
  async isStorageUrlInUse(urlOrKey: string, excludeContext?: { model?: string; id?: string }): Promise<boolean> {
    if (!urlOrKey) return false;
    if (!this.prisma) return true; // Fail closed: missing database connection cannot prove unused
    const validatedKey = this.extractAndValidateObjectKey(urlOrKey);
    if (!validatedKey) return false;

    const keyVariations = [
      urlOrKey,
      validatedKey,
      `/${validatedKey}`,
    ];
    if (this.publicUrl) {
      keyVariations.push(`${this.publicUrl}/${validatedKey}`);
    }

    const prismaAny = this.prisma as any;

    // 1. Study Materials (url, thumbnailUrl)
    if (prismaAny.studyMaterial?.findFirst) {
      try {
        const smConditions: any[] = [
          { url: urlOrKey },
          { url: validatedKey },
          { url: { in: keyVariations } },
          { thumbnailUrl: { in: keyVariations } },
          { url: { endsWith: validatedKey } },
          { thumbnailUrl: { endsWith: validatedKey } },
        ];
        const existing = await prismaAny.studyMaterial.findFirst({
          where: {
            OR: smConditions,
            ...(excludeContext?.model === 'StudyMaterial' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
          },
        });
        if (existing) return true;
      } catch (err) {
        console.error('Error checking studyMaterial references (failing closed):', err);
        return true;
      }
    }

    // 2. MCQ Questions (imageUrl)
    if (prismaAny.mcqQuestion?.findFirst) {
      try {
        const mcqConditions: any[] = [
          { imageUrl: { in: keyVariations } },
          { imageUrl: { endsWith: validatedKey } },
        ];
        const existing = await prismaAny.mcqQuestion.findFirst({
          where: {
            OR: mcqConditions,
            ...(excludeContext?.model === 'McqQuestion' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
          },
        });
        if (existing) return true;
      } catch (err) {
        console.error('Error checking mcqQuestion references (failing closed):', err);
        return true;
      }
    }

    // 3. Student Answers (answerFileUrl)
    if (prismaAny.studentAnswer?.findFirst) {
      try {
        const saConditions: any[] = [
          { answerFileUrl: { in: keyVariations } },
          { answerFileUrl: { endsWith: validatedKey } },
        ];
        const existing = await prismaAny.studentAnswer.findFirst({
          where: {
            OR: saConditions,
            ...(excludeContext?.model === 'StudentAnswer' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
          },
        });
        if (existing) return true;
      } catch (err) {
        console.error('Error checking studentAnswer references (failing closed):', err);
        return true;
      }
    }

    // 4. Custom Form Responses (data JSON)
    if (prismaAny.customFormResponse) {
      try {
        if (prismaAny.$queryRawUnsafe) {
          const rawResponses = await prismaAny.$queryRawUnsafe(
            `SELECT id FROM "custom_form_responses" WHERE "data"::text LIKE $1 LIMIT 1`,
            `%${validatedKey}%`
          );
          if (Array.isArray(rawResponses) && rawResponses.length > 0) return true;
        }
        if (prismaAny.customFormResponse.findMany) {
          const sample = await prismaAny.customFormResponse.findMany({ take: 100 });
          const found = sample.some((r: any) => JSON.stringify(r.data || {}).includes(validatedKey));
          if (found) return true;
        }
      } catch (err) {
        console.error('Error checking customFormResponse references (failing closed):', err);
        return true;
      }
    }

    // 5. Custom Form Definitions (imageUrl or fields JSON, e.g. field imageUrl or header/layout images)
    if (prismaAny.customForm) {
      try {
        if (prismaAny.customForm.findFirst) {
          const formWithImage = await prismaAny.customForm.findFirst({
            where: {
              OR: [
                { imageUrl: { in: keyVariations } },
                { imageUrl: { endsWith: validatedKey } },
              ],
              ...(excludeContext?.model === 'CustomForm' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
            },
          });
          if (formWithImage) return true;
        }
        if (prismaAny.$queryRawUnsafe) {
          const rawForms = await prismaAny.$queryRawUnsafe(
            `SELECT id FROM "custom_forms" WHERE "fields"::text LIKE $1 LIMIT 1`,
            `%${validatedKey}%`
          );
          if (Array.isArray(rawForms) && rawForms.length > 0) return true;
        }
        if (prismaAny.customForm.findMany) {
          const sample = await prismaAny.customForm.findMany({ take: 100 });
          const found = sample.some((f: any) => JSON.stringify(f.fields || {}).includes(validatedKey));
          if (found) return true;
        }
      } catch (err) {
        console.error('Error checking customForm references (failing closed):', err);
        return true;
      }
    }

    // 6. User Avatars (avatar)
    if (prismaAny.user?.findFirst) {
      try {
        const userExisting = await prismaAny.user.findFirst({
          where: {
            OR: [
              { avatar: { in: keyVariations } },
              { avatar: { endsWith: validatedKey } },
            ],
            ...(excludeContext?.model === 'User' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
          },
        });
        if (userExisting) return true;
      } catch (err) {
        console.error('Error checking user avatar references (failing closed):', err);
        return true;
      }
    }

    // 7. Notices (imageUrl)
    if (prismaAny.notice?.findFirst) {
      try {
        const noticeExisting = await prismaAny.notice.findFirst({
          where: {
            OR: [
              { imageUrl: { in: keyVariations } },
              { imageUrl: { endsWith: validatedKey } },
            ],
            ...(excludeContext?.model === 'Notice' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
          },
        });
        if (noticeExisting) return true;
      } catch (err) {
        console.error('Error checking notice references (failing closed):', err);
        return true;
      }
    }

    // 8. Support Tickets (imageUrl)
    if (prismaAny.supportTicket?.findFirst) {
      try {
        const ticketExisting = await prismaAny.supportTicket.findFirst({
          where: {
            OR: [
              { imageUrl: { in: keyVariations } },
              { imageUrl: { endsWith: validatedKey } },
            ],
            ...(excludeContext?.model === 'SupportTicket' && excludeContext.id ? { id: { not: excludeContext.id } } : {}),
          },
        });
        if (ticketExisting) return true;
      } catch (err) {
        console.error('Error checking supportTicket references (failing closed):', err);
        return true;
      }
    }

    // 9. Assignments & Submissions (attachments JSON)
    if (prismaAny.assignment) {
      try {
        if (prismaAny.$queryRawUnsafe) {
          const rawAssignments = await prismaAny.$queryRawUnsafe(
            `SELECT id FROM "assignments" WHERE "attachments"::text LIKE $1 LIMIT 1`,
            `%${validatedKey}%`
          );
          if (Array.isArray(rawAssignments) && rawAssignments.length > 0) return true;
        } else if (prismaAny.assignment.findMany) {
          const sample = await prismaAny.assignment.findMany({ take: 100 });
          const found = sample.some((a: any) => JSON.stringify(a.attachments || {}).includes(validatedKey));
          if (found) return true;
        }
      } catch (err) {
        console.error('Error checking assignment references (failing closed):', err);
        return true;
      }
    }
    if (prismaAny.assignmentSubmission) {
      try {
        if (prismaAny.$queryRawUnsafe) {
          const rawSubmissions = await prismaAny.$queryRawUnsafe(
            `SELECT id FROM "assignment_submissions" WHERE "attachments"::text LIKE $1 LIMIT 1`,
            `%${validatedKey}%`
          );
          if (Array.isArray(rawSubmissions) && rawSubmissions.length > 0) return true;
        } else if (prismaAny.assignmentSubmission.findMany) {
          const sample = await prismaAny.assignmentSubmission.findMany({ take: 100 });
          const found = sample.some((s: any) => JSON.stringify(s.attachments || {}).includes(validatedKey));
          if (found) return true;
        }
      } catch (err) {
        console.error('Error checking assignmentSubmission references (failing closed):', err);
        return true;
      }
    }

    // 10. Doubts (attachments JSON)
    if (prismaAny.doubt) {
      try {
        if (prismaAny.$queryRawUnsafe) {
          const rawDoubts = await prismaAny.$queryRawUnsafe(
            `SELECT id FROM "doubts" WHERE "attachments"::text LIKE $1 LIMIT 1`,
            `%${validatedKey}%`
          );
          if (Array.isArray(rawDoubts) && rawDoubts.length > 0) return true;
        } else if (prismaAny.doubt.findMany) {
          const sample = await prismaAny.doubt.findMany({ take: 100 });
          const found = sample.some((d: any) => JSON.stringify(d.attachments || {}).includes(validatedKey));
          if (found) return true;
        }
      } catch (err) {
        console.error('Error checking doubt references (failing closed):', err);
        return true;
      }
    }

    return false;
  }

  /**
   * Deletes a file from R2 after verifying that it is an authorized managed object key
   * and that no other application record is referencing it.
   * @param objectKey The key or URL of the object in R2
   * @param forcePurge When true, bypasses in-use check (used for evicting oversized uploads)
   */
  async deleteFile(objectKey: string, forcePurge: boolean = false): Promise<boolean> {
    const config = this.getConfig();
    if (!config.isConfigured) {
      return false; // Skip if storage not configured
    }

    const validatedKey = this.extractAndValidateObjectKey(objectKey);
    if (!validatedKey) {
      console.warn(`[StorageService] Refusing to delete unmanaged or invalid storage object: ${objectKey}`);
      return false;
    }

    if (!forcePurge) {
      if (!this.prisma) {
        console.warn(`[StorageService] Database service unavailable. Failing closed to prevent deletion of potentially referenced object: ${validatedKey}`);
        return false;
      }
      const stillInUse = await this.isStorageUrlInUse(validatedKey);
      if (stillInUse) {
        console.warn(`[StorageService] Refusing to delete storage object in use: ${validatedKey}`);
        return false;
      }
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: validatedKey,
      });

      await this.getClient().send(command);
      return true;
    } catch (error: any) {
      console.error('Error deleting file from R2:', error);
      return false;
    }
  }
}
