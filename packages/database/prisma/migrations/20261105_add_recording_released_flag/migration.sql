-- AlterTable: Add isRecordingReleased to live_classes and isReleased to live_class_recordings
ALTER TABLE "live_classes" ADD COLUMN IF NOT EXISTS "isRecordingReleased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "live_class_recordings" ADD COLUMN IF NOT EXISTS "isReleased" BOOLEAN NOT NULL DEFAULT false;

