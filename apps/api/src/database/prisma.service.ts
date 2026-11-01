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

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = CURRENT_SCHEMA
                AND table_name = 'student_profiles'
                AND column_name = 'source'
            ) THEN
                ALTER TABLE "student_profiles" ADD COLUMN "source" TEXT DEFAULT 'DIRECT';
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = CURRENT_SCHEMA
                AND table_name = 'student_profiles'
                AND column_name = 'externalCrmId'
            ) THEN
                ALTER TABLE "student_profiles" ADD COLUMN "externalCrmId" TEXT;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = CURRENT_SCHEMA
                AND table_name = 'enquiries'
                AND column_name = 'externalCrmId'
            ) THEN
                ALTER TABLE "enquiries" ADD COLUMN "externalCrmId" TEXT;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = CURRENT_SCHEMA
                AND table_name = 'api_integrations'
                AND column_name = 'apiKeyHash'
            ) THEN
                ALTER TABLE "api_integrations" ADD COLUMN "apiKeyHash" TEXT;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = CURRENT_SCHEMA
                AND table_name = 'api_integrations'
                AND column_name = 'keySuffix'
            ) THEN
                ALTER TABLE "api_integrations" ADD COLUMN "keySuffix" TEXT;
            END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS "api_integrations" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL DEFAULT 'CRM Integration',
          "apiKey" TEXT UNIQUE,
          "apiKeyHash" TEXT UNIQUE,
          "keyPrefix" TEXT NOT NULL DEFAULT 'edc_live_',
          "keySuffix" TEXT,
          "webhookSecret" TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "centreId" TEXT,
          "lastUsedAt" TIMESTAMP(3),
          "totalRequests" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "webhook_logs" (
          "id" TEXT PRIMARY KEY,
          "apiIntegrationId" TEXT,
          "event" TEXT NOT NULL DEFAULT 'student.enrolled',
          "status" TEXT NOT NULL,
          "statusCode" INTEGER NOT NULL DEFAULT 200,
          "crmId" TEXT,
          "studentName" TEXT,
          "studentEmail" TEXT,
          "admissionNo" TEXT,
          "payload" JSONB,
          "response" JSONB,
          "errorMessage" TEXT,
          "ipAddress" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS "webhook_logs_crmId_idx" ON "webhook_logs"("crmId");
        CREATE INDEX IF NOT EXISTS "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt" DESC);
      `);
    } catch {
      // Non-fatal: table may not exist yet during initial bootstrapping
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
