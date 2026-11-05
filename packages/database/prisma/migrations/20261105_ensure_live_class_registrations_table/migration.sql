-- Ensure live_class_registrations table and constraints exist
CREATE TABLE IF NOT EXISTS "live_class_registrations" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT,
    "registrationToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_class_registrations_pkey" PRIMARY KEY ("id")
);

-- Indices and constraints
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_class_registrations_liveClassId_fkey'
    ) THEN
        ALTER TABLE "live_class_registrations" ADD CONSTRAINT "live_class_registrations_liveClassId_fkey"
        FOREIGN KEY ("liveClassId") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_email_key" ON "live_class_registrations"("liveClassId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_registrationToken_key" ON "live_class_registrations"("registrationToken");
CREATE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_idx" ON "live_class_registrations"("liveClassId");
CREATE INDEX IF NOT EXISTS "live_class_registrations_email_idx" ON "live_class_registrations"("email");
CREATE INDEX IF NOT EXISTS "live_class_registrations_registrationToken_idx" ON "live_class_registrations"("registrationToken");

