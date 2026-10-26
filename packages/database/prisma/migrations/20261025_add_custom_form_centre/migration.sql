-- AlterTable custom_forms: Safely and idempotently ensure centreId exists with FK to centres
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = CURRENT_SCHEMA
        AND table_name = 'custom_forms'
        AND column_name = 'centreId'
    ) THEN
        ALTER TABLE "custom_forms" ADD COLUMN "centreId" TEXT;
    END IF;
END $$;

-- AddForeignKey custom_forms_centreId_fkey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = CURRENT_SCHEMA
        AND constraint_name = 'custom_forms_centreId_fkey'
    ) THEN
        ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_centreId_fkey" 
        FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
