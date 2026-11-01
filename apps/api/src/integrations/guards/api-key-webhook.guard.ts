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
  private static readonly MAX_TIMESTAMP_DRIFT_SECONDS = 300; // 5-minute tolerance

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

    // 3. Extract & Validate Timestamp for Replay Attack Prevention
    const timestampHeader =
      (request.headers['x-webhook-timestamp'] as string) ||
      (request.headers['X-Webhook-Timestamp'] as string) ||
      request.body?.timestamp;

    if (timestampHeader) {
      const parsedTime = Number(timestampHeader);
      const currentTime = Math.floor(Date.now() / 1000);

      // Support either seconds or milliseconds epoch
      const normalizedTime = parsedTime > 1e11 ? Math.floor(parsedTime / 1000) : parsedTime;

      if (isNaN(normalizedTime) || Math.abs(currentTime - normalizedTime) > ApiKeyWebhookGuard.MAX_TIMESTAMP_DRIFT_SECONDS) {
        this.logger.warn(`Rejected replayed or expired webhook. Timestamp: ${timestampHeader}, Current: ${currentTime}`);
        throw new UnauthorizedException(
          `Webhook timestamp outside acceptable tolerance (replay prevention). Request must be within 5 minutes of server time.`,
        );
      }
    }

    // 4. Secure API Key Lookup (One-way SHA-256 hash or raw key fallback)
    const incomingHash = crypto.createHash('sha256').update(apiKey.trim()).digest('hex');

    const integration = await this.prisma.apiIntegration.findFirst({
      where: {
        OR: [
          { apiKeyHash: incomingHash },
          { apiKey: apiKey.trim() },
        ],
        isActive: true,
      },
      include: {
        centre: { select: { id: true, name: true, code: true } },
      },
    });

    if (!integration) {
      throw new UnauthorizedException('Invalid, inactive, or revoked API key.');
    }

    // 5. Verify HMAC SHA-256 signature against raw body
    const rawBody: Buffer =
      request.rawBody ||
      (typeof request.body === 'string'
        ? Buffer.from(request.body)
        : Buffer.from(JSON.stringify(request.body || {})));

    const cleanSignature = signature.trim().replace(/^sha256=/i, '');
    const providedBuf = Buffer.from(cleanSignature, 'hex');

    // Candidate 1: Direct payload signature HMAC(secret, rawBody)
    const expectedDirect = crypto
      .createHmac('sha256', integration.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const directBuf = Buffer.from(expectedDirect, 'hex');

    // Candidate 2: Timestamp-bound signature HMAC(secret, `${timestamp}.${rawBody}`)
    let timestampBuf: Buffer | null = null;
    if (timestampHeader) {
      const expectedTimestamped = crypto
        .createHmac('sha256', integration.webhookSecret)
        .update(Buffer.concat([Buffer.from(`${timestampHeader}.`), rawBody]))
        .digest('hex');
      timestampBuf = Buffer.from(expectedTimestamped, 'hex');
    }

    const matchesDirect =
      directBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(directBuf, providedBuf);

    const matchesTimestamped =
      timestampBuf &&
      timestampBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(timestampBuf, providedBuf);

    if (!matchesDirect && !matchesTimestamped) {
      this.logger.warn(
        `Webhook signature mismatch for integration ${integration.id}. Provided signature did not match direct or timestamped digest.`,
      );
      throw new UnauthorizedException(
        'Invalid webhook signature. Payload tampering detected or incorrect webhook secret used.',
      );
    }

    // 6. Attach integration to request and record usage in background
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
