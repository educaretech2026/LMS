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
    const ddlStatements = [
      // 1. Create integration tables first so subsequent column checks don't fail
      `CREATE TABLE IF NOT EXISTS "api_integrations" (
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
      );`,

      `CREATE TABLE IF NOT EXISTS "webhook_logs" (
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
      );`,

      `CREATE INDEX IF NOT EXISTS "webhook_logs_crmId_idx" ON "webhook_logs"("crmId");`,
      `CREATE INDEX IF NOT EXISTS "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt" DESC);`,

      // 2. Classroom Registrations & Files tables
      `CREATE TABLE IF NOT EXISTS "live_class_registrations" (
        "id" TEXT PRIMARY KEY,
        "liveClassId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT,
        "organization" TEXT,
        "registrationToken" TEXT,
        "status" TEXT NOT NULL DEFAULT 'REGISTERED',
        "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_email_key" ON "live_class_registrations"("liveClassId", "email");`,
      `CREATE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_idx" ON "live_class_registrations"("liveClassId");`,
      `CREATE INDEX IF NOT EXISTS "live_class_registrations_email_idx" ON "live_class_registrations"("email");`,

      `CREATE TABLE IF NOT EXISTS "live_class_files" (
        "id" TEXT PRIMARY KEY,
        "liveClassId" TEXT NOT NULL,
        "uploaderId" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "fileUrl" TEXT NOT NULL,
        "fileSize" INTEGER,
        "mimeType" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "live_class_files_liveClassId_idx" ON "live_class_files"("liveClassId");`,

      // 3. Incremental columns on existing tables
      `ALTER TABLE "custom_forms" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'DIRECT';`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "externalCrmId" TEXT;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "parentOccupation" TEXT;`,
      `ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "externalCrmId" TEXT;`,
      `ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "parentOccupation" TEXT;`,
      `ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);`,
      `ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT;`,
      `ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;`,
      `ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "keySuffix" TEXT;`,
    ];

    for (const ddl of ddlStatements) {
      try {
        await this.$executeRawUnsafe(ddl);
      } catch {
        // Non-fatal: table may not exist yet during initial bootstrapping
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
