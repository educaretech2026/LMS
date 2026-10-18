-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'fee_records'
        AND column_name = 'centreId'
    ) THEN
        ALTER TABLE "fee_records" ADD COLUMN "centreId" TEXT;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fee_records_centreId_fkey'
    ) THEN
        ALTER TABLE "fee_records" ADD CONSTRAINT "fee_records_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
