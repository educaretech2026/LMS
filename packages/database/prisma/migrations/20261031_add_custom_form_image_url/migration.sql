-- AlterTable custom_forms: Safely and idempotently ensure imageUrl exists
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

