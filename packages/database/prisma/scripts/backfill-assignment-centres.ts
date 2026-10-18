import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reconcileLegacyAssignments(dryRun: boolean = false) {
  console.log(`Starting legacy teacher assignment reconciliation (dryRun: ${dryRun})...`);

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
  let singleCentreResolvedCount = 0;
  const ambiguousRecords: Array<{
    assignmentId: string;
    teacherId: string;
    reason: string;
    subjectName?: string;
    standardName?: string;
    userCentresCount: number;
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
    } else if (assignment.teacher?.userCentres?.length === 1) {
      const singleCentreId = assignment.teacher.userCentres[0].centreId;
      singleCentreResolvedCount++;
      if (!dryRun) {
        await prisma.teacherAssignment.update({
          where: { id: assignment.id },
          data: { centreId: singleCentreId },
        });
      }
    } else {
      ambiguousRecords.push({
        assignmentId: assignment.id,
        teacherId: assignment.teacherId,
        subjectName: assignment.subject?.name,
        standardName: assignment.standard?.name,
        userCentresCount: assignment.teacher?.userCentres?.length || 0,
        reason:
          (assignment.teacher?.userCentres?.length || 0) > 1
            ? 'Teacher belongs to multiple centres and assignment lacks batchId; requires explicit centre assignment.'
            : 'Teacher has no centre memberships; cannot infer centre scope.',
      });
    }
  }

  console.log('--- Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Batch Centre: ${batchResolvedCount}`);
  console.log(`Resolved via Unique Teacher Centre: ${singleCentreResolvedCount}`);
  console.log(`Ambiguous (Failing Closed for Safety): ${ambiguousRecords.length}`);

  if (ambiguousRecords.length > 0) {
    console.warn('⚠️ The following assignments could not be safely resolved and remain un-scoped (failing closed):');
    console.table(ambiguousRecords);
  }

  return {
    total: unassigned.length,
    batchResolvedCount,
    singleCentreResolvedCount,
    ambiguousCount: ambiguousRecords.length,
    ambiguousRecords,
  };
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  reconcileLegacyAssignments(isDryRun)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during assignment reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
