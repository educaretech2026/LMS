import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReconcileOptions {
  trustStaffAssignment?: boolean;
}

export async function reconcileLegacyEnquiries(
  dryRun: boolean = true,
  client: any = prisma,
  options: ReconcileOptions = {},
) {
  const trustStaffAssignment = Boolean(options.trustStaffAssignment);
  console.log(`Starting legacy enquiry reconciliation (mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}, trustStaffAssignment: ${trustStaffAssignment})...`);

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
    reason: string;
  }> = [];

  for (const enquiry of unassigned) {
    if (!enquiry.assignedToId || !enquiry.assignedTo) {
      ambiguousRecords.push({
        enquiryId: enquiry.id,
        studentName: enquiry.studentName,
        contactNumber: enquiry.contactNumber,
        assignedToId: null,
        reason: 'Unassigned enquiry; no staff link exists to infer centre ownership. Failing closed to Super Admin review.',
      });
      continue;
    }

    const staffCentres = Array.from(
      new Set(enquiry.assignedTo.userCentres.map((uc: any) => uc.centreId).filter(Boolean)),
    );

    if (staffCentres.length === 1) {
      if (trustStaffAssignment) {
        resolvedCount++;
        if (!dryRun) {
          await client.enquiry.update({
            where: { id: enquiry.id },
            data: { centreId: staffCentres[0] },
          });
        }
      } else {
        ambiguousRecords.push({
          enquiryId: enquiry.id,
          studentName: enquiry.studentName,
          contactNumber: enquiry.contactNumber,
          assignedToId: enquiry.assignedToId,
          reason: 'Assigned staff belongs to a single centre, but staff assignment occurs post-intake in CRM workflows and does not guarantee originating centre. Retained as unresolved (centreId: null) pending Super Admin confirmation.',
        });
      }
    } else {
      ambiguousRecords.push({
        enquiryId: enquiry.id,
        studentName: enquiry.studentName,
        contactNumber: enquiry.contactNumber,
        assignedToId: enquiry.assignedToId,
        reason:
          staffCentres.length > 1
            ? 'Assigned staff is associated with multiple centres; cannot unambiguously infer tenant ownership without manual review.'
            : 'Assigned staff has no centre memberships; cannot infer centre scope.',
      });
    }
  }

  console.log('--- Enquiry Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Single Staff Centre (Explicitly Trusted): ${resolvedCount}`);
  console.log(`Ambiguous (Failing Closed for Safety): ${ambiguousRecords.length}`);

  if (ambiguousRecords.length > 0) {
    console.warn('⚠️ The following enquiries could not be safely resolved and remain un-scoped (failing closed):');
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
  const trustStaffAssignment = process.argv.includes('--trust-staff-assignment');
  const dryRun = !isApply;
  if (dryRun) {
    console.log('Running in DRY-RUN mode by default. Pass --apply to persist changes.');
  } else {
    console.log('Applying changes to database...');
  }
  if (!trustStaffAssignment) {
    console.log('Notice: --trust-staff-assignment not passed. Staff assignment will not be assumed as proof of origin.');
  }
  reconcileLegacyEnquiries(dryRun, prisma, { trustStaffAssignment })
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during enquiry reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
