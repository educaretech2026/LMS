import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
   * @param filename original filename
   * @param contentType mime type of the file
   * @returns an object with the pre-signed upload URL and the final public URL where the file will be accessible.
   */
  async getPresignedUploadUrl(filename: string, contentType: string) {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
      throw new HttpException('Storage is not configured on the server.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const uniqueId = Math.random().toString(36).substring(2, 15);
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
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
}
