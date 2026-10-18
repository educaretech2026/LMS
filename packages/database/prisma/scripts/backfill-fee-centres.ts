import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reconcileLegacyFeeRecords(dryRun: boolean = true) {
  console.log(`Starting legacy fee record reconciliation (mode: ${dryRun ? 'DRY-RUN' : 'APPLY'})...`);

  const unassigned = await prisma.feeRecord.findMany({
    where: { centreId: null },
    include: {
      student: {
        include: {
          enrollments: {
            include: {
              batch: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${unassigned.length} fee records without an authoritative centreId.`);

  let resolvedCount = 0;
  const ambiguousRecords: Array<{
    feeRecordId: string;
    studentId: string;
    receiptNo: string;
    reason: string;
  }> = [];

  for (const fee of unassigned) {
    const studentCentres = Array.from(
      new Set(
        (fee.student?.enrollments || [])
          .map((e) => e.batch?.centreId)
          .filter(Boolean) as string[]
      )
    );

    if (studentCentres.length === 1) {
      resolvedCount++;
      if (!dryRun) {
        await prisma.feeRecord.update({
          where: { id: fee.id },
          data: { centreId: studentCentres[0] },
        });
      }
    } else {
      ambiguousRecords.push({
        feeRecordId: fee.id,
        studentId: fee.studentId,
        receiptNo: fee.receiptNo,
        reason:
          studentCentres.length > 1
            ? 'Student enrolled across multiple centres; ambiguous ownership requires manual administrative reconciliation.'
            : 'Student has no active batch centre enrollments; cannot infer centre scope.',
      });
    }
  }

  console.log('--- Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Unambiguous Student Centre: ${resolvedCount}`);
  console.log(`Ambiguous (Failing Closed for Safety): ${ambiguousRecords.length}`);

  if (ambiguousRecords.length > 0) {
    console.warn('⚠️ The following fee records could not be safely resolved and remain un-scoped (failing closed):');
    console.table(ambiguousRecords);
  }

  return {
    total: unassigned.length,
    resolvedCount,
    ambiguousCount: ambiguousRecords.length,
    ambiguousRecords,
  };
}

if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  const dryRun = !isApply;
  if (dryRun) {
    console.log('Running in DRY-RUN mode by default. Pass --apply to persist changes.');
  } else {
    console.log('Applying changes to database...');
  }
  reconcileLegacyFeeRecords(dryRun)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during fee record reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
