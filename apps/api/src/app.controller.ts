import { Controller, Get, ServiceUnavailableException, Optional } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * General / legacy health check
   */
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  /**
   * Liveness Probe: Confirms Node.js event loop is responsive.
   * Does not perform external I/O so transient database errors do not cause container restart loops.
   */
  @Public()
  @Get(['health/live', 'livez'])
  getLiveness() {
    return {
      status: 'alive',
      uptimeSecs: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness Probe: Confirms application is ready to receive traffic.
   * Checks maintenance mode, database connectivity, and Redis availability.
   * If unhealthy, returns 503 so load balancers drain traffic from this instance.
   */
  @Public()
  @Get(['health/ready', 'readyz'])
  async getReadiness() {
    // 1. Maintenance Mode / Traffic Quiesce Check
    if (process.env.MAINTENANCE_MODE === 'true') {
      throw new ServiceUnavailableException({
        status: 'maintenance',
        message: 'System is undergoing planned maintenance. Traffic drained.',
        timestamp: new Date().toISOString(),
      });
    }

    const checks: Record<string, string> = {};

    // 2. Database Connectivity Check
    if (this.prisma) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        checks.database = 'connected';
      } catch (err: any) {
        throw new ServiceUnavailableException({
          status: 'degraded',
          message: 'Database check failed',
          error: err?.message || 'Database unreachable',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      checks.database = 'unmonitored';
    }

    // 3. Redis Connectivity Check (when mandatory)
    const isRedisMandatory = Boolean(
      process.env.REDIS_URL ||
      process.env.NODE_ENV === 'production' ||
      process.env.APP_ENV === 'staging' ||
      process.env.DEPLOYED_STAGING === 'true',
    );
    if (this.redisService && isRedisMandatory) {
      if (!this.redisService.isConnected) {
        throw new ServiceUnavailableException({
          status: 'degraded',
          message: 'Redis connection unavailable in mandatory environment',
          timestamp: new Date().toISOString(),
        });
      }
      checks.redis = 'connected';
    }

    return {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
