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

const IP_REGEX = /^(?:(?:::ffff:)?(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[a-fA-F0-9]{1,4}:){1,7}[a-fA-F0-9]{1,4}|::1|localhost)$/;

function sanitizeIp(rawIp: any): string | null {
  if (!rawIp || typeof rawIp !== 'string') return null;
  const trimmed = rawIp.replace(/^::ffff:/, '').trim();
  if (IP_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;
    const rangeNum = ((rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3]) >>> 0;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      console.error('[StrictThrottlerGuard] Rate limiter backend storage error:', err?.message || err);
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Rate limiting service is temporarily unavailable. Please retry shortly.',
          error: 'Service Unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  isSocketFromTrustedProxy(socketAddress: string, req?: Record<string, any>): boolean {
    const cleanSocket = sanitizeIp(socketAddress);
    if (!cleanSocket) return false;

    // Check environment-configured trusted proxy list
    const envProxies = process.env.TRUSTED_PROXIES;
    if (envProxies) {
      const allowedEntries = envProxies.split(',').map((p) => p.trim().replace(/^::ffff:/, ''));
      if (allowedEntries.includes('loopback') && (cleanSocket === '127.0.0.1' || cleanSocket === '::1' || cleanSocket === 'localhost')) {
        return true;
      }
      for (const entry of allowedEntries) {
        if (entry.includes('/')) {
          if (isIpInCidr(cleanSocket, entry)) return true;
        } else if (entry === cleanSocket) {
          return true;
        }
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
    const rawSocket = req?.socket?.remoteAddress;
    const socketAddress = sanitizeIp(rawSocket) || '127.0.0.1';

    // Verify if socket peer is a genuine trusted reverse proxy
    const isTrusted = this.isSocketFromTrustedProxy(socketAddress, req);

    if (isTrusted) {
      // Behind a trusted proxy:
      // If Cloudflare header is present and proxy is trusted:
      const cfIp = sanitizeIp(req?.headers?.['cf-connecting-ip']);
      if (cfIp) {
        return cfIp;
      }

      // If Express verified req.ip is available
      const reqIp = sanitizeIp(req?.ip);
      if (reqIp && reqIp !== socketAddress) {
        return reqIp;
      }

      // Or parse the first client IP in X-Forwarded-For
      const xForwardedFor = req?.headers?.['x-forwarded-for'];
      if (xForwardedFor && typeof xForwardedFor === 'string') {
        const firstClientIp = sanitizeIp(xForwardedFor.split(',')[0]);
        if (firstClientIp) {
          return firstClientIp;
        }
      }
    }

    // Direct connection or untrusted socket peer:
    // Strictly ignore client-supplied X-Forwarded-For headers to prevent spoofing
    return socketAddress;
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

