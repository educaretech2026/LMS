-- AlterTable Enquiry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'enquiries'
        AND column_name = 'centreId'
    ) THEN
        ALTER TABLE "enquiries" ADD COLUMN "centreId" TEXT;
    END IF;
END $$;

-- AddForeignKey Enquiry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'enquiries_centreId_fkey'
    ) THEN
        ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable StudyMaterial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'study_materials'
        AND column_name = 'centreId'
    ) THEN
        ALTER TABLE "study_materials" ADD COLUMN "centreId" TEXT;
    END IF;
END $$;

-- AddForeignKey StudyMaterial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'study_materials_centreId_fkey'
    ) THEN
        ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
