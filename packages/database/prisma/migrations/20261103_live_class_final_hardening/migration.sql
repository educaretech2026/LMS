-- Live Class Final Security & Recording Hardening Migration
-- Idempotent and non-destructive DDL

-- 1. Extend LiveClassStatus enum with CANCELLED
ALTER TYPE "LiveClassStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. Add substituteTeacherId and egressId to live_classes
ALTER TABLE "live_classes" ADD COLUMN IF NOT EXISTS "substituteTeacherId" TEXT;
ALTER TABLE "live_classes" ADD COLUMN IF NOT EXISTS "egressId" TEXT;

-- 3. Add foreign key for substituteTeacherId safely
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_classes_substituteTeacherId_fkey'
    ) THEN
        ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_substituteTeacherId_fkey"
        FOREIGN KEY ("substituteTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Index for substituteTeacherId
CREATE INDEX IF NOT EXISTS "live_classes_substituteTeacherId_idx" ON "live_classes"("substituteTeacherId");

-- 5. Add status column to live_class_registrations
ALTER TABLE "live_class_registrations" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'REGISTERED';

-- 6. Create live_class_recordings table
CREATE TABLE IF NOT EXISTS "live_class_recordings" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "egressId" TEXT,
    "status" "RecordingStatus" NOT NULL DEFAULT 'NOT_RECORDED',
    "fileUrl" TEXT,
    "fileSize" BIGINT,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_class_recordings_pkey" PRIMARY KEY ("id")
);

-- 7. Indices and constraints for live_class_recordings
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_recordings_egressId_key" ON "live_class_recordings"("egressId");
CREATE INDEX IF NOT EXISTS "live_class_recordings_liveClassId_idx" ON "live_class_recordings"("liveClassId");
CREATE INDEX IF NOT EXISTS "live_class_recordings_egressId_idx" ON "live_class_recordings"("egressId");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_class_recordings_liveClassId_fkey'
    ) THEN
        ALTER TABLE "live_class_recordings" ADD CONSTRAINT "live_class_recordings_liveClassId_fkey"
        FOREIGN KEY ("liveClassId") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

