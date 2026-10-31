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

    // Safely and idempotently ensure incremental migrations that might have been skipped in deployment
    try {
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = CURRENT_SCHEMA
                AND table_name = 'custom_forms'
                AND column_name = 'imageUrl'
            ) THEN
                ALTER TABLE "custom_forms" ADD COLUMN "imageUrl" TEXT;
            END IF;
        END $$;
      `);
    } catch {
      // Non-fatal: table may not exist yet during initial bootstrapping
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
