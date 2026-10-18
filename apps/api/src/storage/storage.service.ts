import { Injectable, HttpException, HttpStatus, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, assertCentreAccess } from '../common/utils/tenant.util';
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

  constructor(@Optional() private prisma?: PrismaService) {
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

    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      throw new HttpException('Storage is not configured on the server.', HttpStatus.INTERNAL_SERVER_ERROR);
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
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    try {
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      const finalUrl = `${this.publicUrl}/${objectKey}`;
      return { uploadUrl, finalUrl, objectKey, maxSizeBytes, expiresIn };
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
   * Validates the actual size of an uploaded object directly against Cloudflare R2 / S3 via HeadObject.
   * If the object exceeds the allowed quota, it is immediately purged from storage and rejected.
   */
  async validateAndEnforceObjectSize(
    urlOrKey: string,
    customMaxSizeBytes?: number
  ): Promise<{ valid: boolean; actualSizeBytes: number }> {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
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
        Bucket: this.bucketName,
        Key: validatedKey,
      });

      const head = await this.s3Client.send(command);
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
   * - Enforces server-defined size limit policy (clients cannot specify limit).
   * - Authenticates upload ownership: verifies user owns the upload key.
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

    // Authenticate upload ownership
    if (user && !isSuperAdmin(user)) {
      if (validatedKey.startsWith('materials/') || validatedKey.startsWith('thumbnails/')) {
        const ownerId = this.extractOwnerFromKey(validatedKey);
        if (ownerId && ownerId !== user.id) {
          throw new ForbiddenException('Access denied: You can only finalize your own uploads.');
        }
      } else if (validatedKey.startsWith('forms/')) {
        const parts = validatedKey.split('/');
        const formId = parts[1];
        if (this.prisma) {
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
    }

    // Server-enforced size limit policy (no client tampering)
    let serverLimit: number;
    if (validatedKey.startsWith('materials/')) {
      serverLimit = 100 * 1024 * 1024; // 100 MB
    } else if (validatedKey.startsWith('forms/')) {
      let customLimit = 25 * 1024 * 1024;
      const parts = validatedKey.split('/');
      const formId = parts[1];
      if (this.prisma) {
        const form = await (this.prisma as any).customForm?.findUnique?.({ where: { id: formId } });
        if (form?.maxFileSizeBytes) customLimit = form.maxFileSizeBytes;
      }
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
   */
  async cleanupOrphanUploads(maxAgeHours: number = 2): Promise<{ scanned: number; purged: number }> {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !this.prisma) {
      return { scanned: 0, purged: 0 };
    }

    try {
      const thresholdTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
      let purgedCount = 0;
      let scannedCount = 0;

      const prefixes = ['materials/', 'thumbnails/', 'forms/'];
      for (const prefix of prefixes) {
        const listCmd = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: 100,
        });

        const listRes = await this.s3Client.send(listCmd);
        const contents = listRes.Contents || [];
        for (const item of contents) {
          if (!item.Key || !item.LastModified) continue;
          scannedCount++;
          if (item.LastModified.getTime() < thresholdTime) {
            const inUse = await this.isStorageUrlInUse(item.Key);
            if (!inUse) {
              const deleted = await this.deleteFile(item.Key, false);
              if (deleted) purgedCount++;
            }
          }
        }
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

    // 5. Custom Form Definitions (fields JSON, e.g. field imageUrl or header/layout images)
    if (prismaAny.customForm) {
      try {
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
        console.error('Error checking customForm fields references (failing closed):', err);
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
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
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
