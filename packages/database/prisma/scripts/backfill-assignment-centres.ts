import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reconcileLegacyAssignments(dryRun: boolean = true) {
  console.log(`Starting legacy teacher assignment reconciliation (mode: ${dryRun ? 'DRY-RUN' : 'APPLY'})...`);

  const unassigned = await prisma.teacherAssignment.findMany({
    where: { centreId: null },
    include: {
      batch: true,
      teacher: {
        include: {
          userCentres: true,
        },
      },
      subject: true,
      standard: true,
    },
  });

  console.log(`Found ${unassigned.length} teacher assignments without an authoritative centreId.`);

  let batchResolvedCount = 0;
  const ambiguousRecords: Array<{
    assignmentId: string;
    teacherId: string;
    reason: string;
    subjectName?: string;
    standardName?: string;
  }> = [];

  for (const assignment of unassigned) {
    if (assignment.batch?.centreId) {
      batchResolvedCount++;
      if (!dryRun) {
        await prisma.teacherAssignment.update({
          where: { id: assignment.id },
          data: { centreId: assignment.batch.centreId },
        });
      }
    } else {
      ambiguousRecords.push({
        assignmentId: assignment.id,
        teacherId: assignment.teacherId,
        subjectName: assignment.subject?.name,
        standardName: assignment.standard?.name,
        reason: 'Assignment lacks batch link; cannot infer authoritative centre from current teacher membership alone. Left unscoped to fail closed until manual admin reconciliation.',
      });
    }
  }

  console.log('--- Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Batch Centre: ${batchResolvedCount}`);
  console.log(`Ambiguous (Failing Closed for Safety): ${ambiguousRecords.length}`);

  if (ambiguousRecords.length > 0) {
    console.warn('⚠️ The following assignments could not be safely resolved and remain un-scoped (failing closed):');
    console.table(ambiguousRecords);
  }

  return {
    total: unassigned.length,
    batchResolvedCount,
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
  reconcileLegacyAssignments(dryRun)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during assignment reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
