import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { cleanEnvValue } from '../common/config/env.loader';

@Injectable()
export class CloudflareService {
  async getDirectUploadUrl() {
    const accountId = cleanEnvValue(process.env.CLOUDFLARE_ACCOUNT_ID);
    const token = cleanEnvValue(process.env.CLOUDFLARE_STREAM_API_TOKEN);

    if (!accountId || !token) {
      throw new HttpException('Cloudflare credentials not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600,
          requireSignedURLs: false,
          allowedOrigins: ["*"]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloudflare API error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data.result; 
    } catch (error: any) {
      console.error(error);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
