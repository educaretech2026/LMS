import { Injectable, ExecutionContext, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerStorageService,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';

@Injectable()
export class StrictThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Optional() @InjectThrottlerOptions() options?: ThrottlerModuleOptions,
    @Optional() @InjectThrottlerStorage() storageService?: ThrottlerStorage,
    @Optional() reflector?: Reflector,
  ) {
    super(
      options || { throttlers: [{ limit: 10, ttl: 60000 }] },
      storageService || new ThrottlerStorageService(),
      reflector || new Reflector(),
    );
  }

  isSocketFromTrustedProxy(socketAddress: string, req?: Record<string, any>): boolean {
    const cleanSocket = String(socketAddress || '').replace(/^::ffff:/, '').trim();
    if (!cleanSocket) return false;

    // Check environment-configured trusted proxy list
    const envProxies = process.env.TRUSTED_PROXIES;
    if (envProxies) {
      const allowed = envProxies.split(',').map((p) => p.trim().replace(/^::ffff:/, ''));
      if (allowed.includes('loopback') && (cleanSocket === '127.0.0.1' || cleanSocket === '::1' || cleanSocket === 'localhost')) {
        return true;
      }
      if (allowed.includes(cleanSocket)) {
        return true;
      }
    }

    // In non-production, loopback is trusted by default
    if (process.env.NODE_ENV !== 'production') {
      if (cleanSocket === '127.0.0.1' || cleanSocket === '::1' || cleanSocket === 'localhost') {
        return true;
      }
    }

    // Check if Express trust proxy confirmed upstream trust and populated req.ips
    if (req?.ips && Array.isArray(req.ips) && req.ips.length > 0) {
      return true;
    }

    return false;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const socketAddress = String(req?.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim();

    // Verify if socket peer is a genuine trusted reverse proxy
    const isTrusted = this.isSocketFromTrustedProxy(socketAddress, req);

    if (isTrusted) {
      // Behind a trusted proxy:
      // If Cloudflare header is present and proxy is trusted:
      const cfIp = req?.headers?.['cf-connecting-ip'];
      if (cfIp && typeof cfIp === 'string') {
        return cfIp.replace(/^::ffff:/, '').trim();
      }

      // If Express verified req.ip is available
      if (req?.ip && req.ip !== socketAddress) {
        return String(req.ip).replace(/^::ffff:/, '').trim();
      }

      // Or parse the first client IP in X-Forwarded-For
      const xForwardedFor = req?.headers?.['x-forwarded-for'];
      if (xForwardedFor && typeof xForwardedFor === 'string') {
        const clientIp = xForwardedFor.split(',')[0].trim().replace(/^::ffff:/, '');
        if (clientIp) {
          return clientIp;
        }
      }
    }

    // Direct connection or untrusted socket peer:
    // Strictly ignore client-supplied X-Forwarded-For headers to prevent spoofing
    return socketAddress || '127.0.0.1';
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many enquiry submissions. Please try again later.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

