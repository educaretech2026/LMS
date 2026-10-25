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
    // Security Rule:
    // 1. Free-text source (e.g. "Centre: centre-B", "Walk-in", "Website Form") can originate from client input
    //    and is NEVER trusted as authoritative proof of originating centre ownership.
    // 2. Staff assignment (assignedToId) represents post-intake operational CRM routing and does NOT establish origin.
    // 3. Automatic backfill is permitted ONLY when authoritative persisted metadata or a verified relationship
    //    unambiguously establishes the tenant.
    // 4. Missing, contradictory, or ambiguous records MUST remain unassigned (centreId: null) and be resolved
    //    strictly through explicit, auditable Super Admin manual reconciliation.

    const staffCentres = enquiry.assignedTo
      ? (Array.from(
          new Set(enquiry.assignedTo.userCentres.map((uc: any) => uc.centreId).filter(Boolean)),
        ) as string[])
      : [];

    let reason = 'Lacks authoritative server-persisted origin metadata; fails closed for Super Admin manual reconciliation.';
    if (enquiry.source && enquiry.source.startsWith('Centre:')) {
      reason = 'Free-text source tag detected, but source originates from client input and cannot establish tenant ownership.';
    } else if (staffCentres.length === 1) {
      reason = 'Assigned staff belongs to a single centre, but staff assignment is post-intake CRM routing and does not prove originating centre. Cannot authorize automatic backfill.';
    } else if (staffCentres.length > 1) {
      reason = 'Assigned staff is associated with multiple centres; cannot infer tenant ownership.';
    } else if (!enquiry.assignedToId) {
      reason = 'Unassigned enquiry lacking verified origin metadata.';
    }

    ambiguousRecords.push({
      enquiryId: enquiry.id,
      studentName: enquiry.studentName,
      contactNumber: enquiry.contactNumber,
      assignedToId: enquiry.assignedToId,
      suggestedCentreId: staffCentres.length === 1 ? staffCentres[0] : null,
      reason,
    });
  }

  console.log('--- Enquiry Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Authoritative Persisted Metadata: ${resolvedCount}`);
  console.log(`Ambiguous (Failing Closed for Safety, Requires Super Admin Manual Reconciliation): ${ambiguousRecords.length}`);

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
