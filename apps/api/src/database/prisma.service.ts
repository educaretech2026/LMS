import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@educare/database';
import { assertValidTargetForEnvironment } from '../common/config/database-target.validator';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Assert target validity before opening socket/pool connections
    assertValidTargetForEnvironment(process.env.DATABASE_URL);
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
