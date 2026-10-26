-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = CURRENT_SCHEMA
        AND table_name = 'study_materials'
        AND column_name = 'isPublic'
    ) THEN
        ALTER TABLE "study_materials" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
