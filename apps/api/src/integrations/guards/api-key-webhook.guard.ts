import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApiKeyWebhookGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyWebhookGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Extract API Key from headers
    const apiKey =
      (request.headers['x-api-key'] as string) ||
      (request.headers['X-API-Key'] as string) ||
      this.extractBearerApiKey(request.headers['authorization']);

    if (!apiKey) {
      throw new UnauthorizedException(
        'Missing API key. Provide your integration key via X-API-Key header.',
      );
    }

    // 2. Extract Webhook Signature
    const signature =
      (request.headers['x-webhook-signature'] as string) ||
      (request.headers['X-Webhook-Signature'] as string) ||
      (request.headers['x-hub-signature-256'] as string);

    if (!signature) {
      throw new UnauthorizedException(
        'Missing webhook signature. Calculate HMAC SHA-256 over the payload with your secret and pass it via X-Webhook-Signature header.',
      );
    }

    // 3. Find active integration record
    const integration = await this.prisma.apiIntegration.findFirst({
      where: {
        apiKey,
        isActive: true,
      },
    });

    if (!integration) {
      throw new UnauthorizedException('Invalid, inactive, or revoked API key.');
    }

    // 4. Verify HMAC SHA-256 signature against raw body
    const rawBody: Buffer =
      request.rawBody ||
      (typeof request.body === 'string'
        ? Buffer.from(request.body)
        : Buffer.from(JSON.stringify(request.body || {})));

    const expectedDigest = crypto
      .createHmac('sha256', integration.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const cleanSignature = signature.trim().replace(/^sha256=/i, '');

    const expectedBuf = Buffer.from(expectedDigest, 'hex');
    const providedBuf = Buffer.from(cleanSignature, 'hex');

    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      this.logger.warn(
        `Webhook signature mismatch for integration ${integration.id}. Expected: ${expectedDigest.slice(0, 10)}..., Provided: ${cleanSignature.slice(0, 10)}...`,
      );
      throw new UnauthorizedException(
        'Invalid webhook signature. Payload tampering detected or incorrect webhook secret used.',
      );
    }

    // 5. Attach integration to request and record usage in background
    request.integration = integration;
    this.prisma.apiIntegration
      .update({
        where: { id: integration.id },
        data: {
          lastUsedAt: new Date(),
          totalRequests: { increment: 1 },
        },
      })
      .catch((err) =>
        this.logger.error(`Failed to update integration usage: ${err.message}`),
      );

    return true;
  }

  private extractBearerApiKey(authorization?: string): string | null {
    if (!authorization) return null;
    const parts = authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
    return null;
  }
}
