-- CreateEnum
CREATE TYPE "DeliveryProvider" AS ENUM ('LIVEKIT', 'GOOGLE_MEET', 'ZOOM', 'JITSI');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('NOT_RECORDED', 'RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "live_classes" ADD COLUMN IF NOT EXISTS "deliveryProvider" "DeliveryProvider" NOT NULL DEFAULT 'LIVEKIT',
ADD COLUMN IF NOT EXISTS "externalMeetingUrl" TEXT,
ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT,
ADD COLUMN IF NOT EXISTS "recordingStatus" "RecordingStatus" NOT NULL DEFAULT 'NOT_RECORDED',
ADD COLUMN IF NOT EXISTS "whiteboardData" JSONB,
ADD COLUMN IF NOT EXISTS "teacherId" TEXT;

-- AlterTable
ALTER TABLE "live_class_registrations" ADD COLUMN IF NOT EXISTS "registrationToken" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "live_class_messages" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_class_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "live_class_files" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_class_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "live_classes_scheduledAt_status_idx" ON "live_classes"("scheduledAt", "status");
CREATE INDEX IF NOT EXISTS "live_classes_centreId_status_idx" ON "live_classes"("centreId", "status");
CREATE INDEX IF NOT EXISTS "live_classes_teacherId_idx" ON "live_classes"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_registrationToken_key" ON "live_class_registrations"("registrationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_email_key" ON "live_class_registrations"("liveClassId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "live_class_messages_liveClassId_createdAt_idx" ON "live_class_messages"("liveClassId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "live_class_files_liveClassId_idx" ON "live_class_files"("liveClassId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_classes_teacherId_fkey') THEN
        ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_class_messages_liveClassId_fkey') THEN
        ALTER TABLE "live_class_messages" ADD CONSTRAINT "live_class_messages_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_class_files_liveClassId_fkey') THEN
        ALTER TABLE "live_class_files" ADD CONSTRAINT "live_class_files_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
