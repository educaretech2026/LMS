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
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Rely strictly on socket remote address or secure connection IP
    // Do NOT trust arbitrary unverified client-supplied headers (like spoofed X-Forwarded-For)
    const rawIp = req?.socket?.remoteAddress || req?.ip || '127.0.0.1';
    return String(rawIp).replace(/^::ffff:/, '').trim();
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
