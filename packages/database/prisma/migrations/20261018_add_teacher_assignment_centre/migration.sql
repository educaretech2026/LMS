-- AddColumn (safe: only if column does not already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='teacher_assignments' AND column_name='centreId'
  ) THEN
    ALTER TABLE "teacher_assignments" ADD COLUMN "centreId" TEXT;
  END IF;
END $$;

-- AddForeignKey (safe: only if constraint does not already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='teacher_assignments_centreId_fkey'
  ) THEN
    ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
