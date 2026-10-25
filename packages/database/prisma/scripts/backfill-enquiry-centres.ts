import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reconcileLegacyEnquiries(
  dryRun: boolean = true,
  client: any = prisma,
) {
  console.log(`Starting legacy enquiry reconciliation (mode: ${dryRun ? 'DRY-RUN' : 'APPLY'})...`);

  const unassigned = await client.enquiry.findMany({
    where: { centreId: null },
    include: {
      assignedTo: {
        include: {
          userCentres: true,
        },
      },
    },
  });

  console.log(`Found ${unassigned.length} enquiries without an authoritative centreId.`);

  let resolvedCount = 0;
  const ambiguousRecords: Array<{
    enquiryId: string;
    studentName: string;
    contactNumber: string;
    assignedToId: string | null;
    suggestedCentreId?: string | null;
    reason: string;
  }> = [];

  for (const enquiry of unassigned) {
    // Check if enquiry has authoritative origin metadata (e.g. source tag specifying verified centre)
    let authoritativeCentreId: string | null = null;
    if (enquiry.source && enquiry.source.startsWith('Centre:')) {
      const parsedCentreId = enquiry.source.replace(/^Centre:\s*/, '').trim();
      const centre = await client.centre.findUnique({ where: { id: parsedCentreId } });
      if (centre && centre.status === 'ACTIVE') {
        authoritativeCentreId = centre.id;
      }
    }

    if (authoritativeCentreId) {
      resolvedCount++;
      if (!dryRun) {
        await client.enquiry.update({
          where: { id: enquiry.id },
          data: { centreId: authoritativeCentreId },
        });
      }
      continue;
    }

    // Staff assignment analysis: investigative context only, not proof of origin
    const staffCentres = enquiry.assignedTo
      ? (Array.from(
          new Set(enquiry.assignedTo.userCentres.map((uc: any) => uc.centreId).filter(Boolean)),
        ) as string[])
      : [];

    ambiguousRecords.push({
      enquiryId: enquiry.id,
      studentName: enquiry.studentName,
      contactNumber: enquiry.contactNumber,
      assignedToId: enquiry.assignedToId,
      suggestedCentreId: staffCentres.length === 1 ? staffCentres[0] : null,
      reason:
        staffCentres.length === 1
          ? 'Assigned staff belongs to a single centre, but staff assignment is post-intake CRM routing and does not prove originating centre. Cannot authorize automatic backfill. Retained as unresolved (centreId: null) for Super Admin review.'
          : staffCentres.length > 1
          ? 'Assigned staff is associated with multiple centres; cannot infer tenant ownership.'
          : 'No assigned staff or staff has no centre memberships; lacks authoritative originating metadata.',
    });
  }

  console.log('--- Enquiry Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Authoritative Originating Metadata: ${resolvedCount}`);
  console.log(`Ambiguous (Failing Closed for Safety, Requires Super Admin Review): ${ambiguousRecords.length}`);

  if (ambiguousRecords.length > 0) {
    console.warn('⚠️ The following enquiries could not be safely resolved and remain unassigned (failing closed):');
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
    console.log('Applying changes to database based strictly on authoritative origin metadata...');
  }
  reconcileLegacyEnquiries(dryRun, prisma)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during enquiry reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
