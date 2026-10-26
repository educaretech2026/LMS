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

function assertSafeCliReconciliationTarget(argv: string[]): boolean {
  const isApply = argv.includes('--apply');
  if (!isApply) {
    return true; // Default dry-run
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl || !rawUrl.trim()) {
    console.error('FATAL RECONCILIATION VIOLATION: DATABASE_URL is missing or empty.');
    process.exit(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    console.error('FATAL RECONCILIATION VIOLATION: DATABASE_URL is malformed and could not be parsed.');
    process.exit(1);
  }

  const hostname = (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  const database = (parsed.pathname || '').replace(/^\//, '').split('?')[0].trim();
  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  const sslMode = parsed.searchParams.get('sslmode');
  const sanitizedTarget = `host: ${hostname}, port: ${port}, db: ${database}, ssl: ${sslMode || 'none'}`;

  // Unconditional block on production systems - no environment variable bypass permitted
  const configuredProdIps = process.env.PRODUCTION_DATABASE_IPS
    ? process.env.PRODUCTION_DATABASE_IPS.split(',').map((ip) => ip.trim().toLowerCase()).filter(Boolean)
    : [];
  const knownProductionIps = [
    '148.135.138.196',
    '::ffff:148.135.138.196',
    '::ffff:9487:8ac4',
    '0:0:0:0:0:ffff:9487:8ac4',
    ...configuredProdIps,
  ];

  const configuredProdHosts = process.env.PRODUCTION_DATABASE_HOSTS
    ? process.env.PRODUCTION_DATABASE_HOSTS.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    : [];
  const knownProductionHosts = [
    'educarelearning.in',
    'api.educarelearning.in',
    'db.educarelearning.in',
    'database.educarelearning.in',
    'postgres.educarelearning.in',
    'lms.educarelearning.in',
    'prod-db.educarelearning.in',
    'prod.educarelearning.in',
    ...configuredProdHosts,
  ];

  const configuredProdDbs = process.env.PRODUCTION_DATABASE_NAMES
    ? process.env.PRODUCTION_DATABASE_NAMES.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
    : [];
  const knownProductionDbs = ['educare_prod', 'educare_production', ...configuredProdDbs];

  const isProductionTarget =
    knownProductionIps.includes(hostname) ||
    knownProductionHosts.includes(hostname) ||
    (hostname.endsWith('.educarelearning.in') && !hostname.includes('staging')) ||
    knownProductionDbs.includes(database);

  if (isProductionTarget) {
    console.error(
      `FATAL RECONCILIATION VIOLATION: Database target (${sanitizedTarget}) is a production system. Automatic CLI reconciliation mutations are strictly prohibited on production databases. Use authenticated Super Admin API workflows.`,
    );
    process.exit(1);
  }

  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'staging-db' ||
    hostname === 'postgres' ||
    hostname === 'db';

  const isDeployedStaging =
    process.env.DEPLOYED_STAGING === 'true' ||
    process.env.STAGING_DEPLOYED === 'true' ||
    process.env.REQUIRE_REMOTE_STAGING_DB === 'true';

  const approvedStagingHostsEnv = [
    ...(process.env.APPROVED_STAGING_HOSTS ? process.env.APPROVED_STAGING_HOSTS.split(',') : []),
    ...(process.env.STAGING_DATABASE_ALLOWLIST ? process.env.STAGING_DATABASE_ALLOWLIST.split(',') : []),
    ...(process.env.STAGING_DATABASE_HOST ? [process.env.STAGING_DATABASE_HOST] : []),
  ].map((h) => h.trim().toLowerCase()).filter(Boolean);

  // Host identity must be approved independently - database name is NEVER proof of server identity
  const isApprovedStagingHost =
    approvedStagingHostsEnv.includes(hostname) ||
    hostname.startsWith('staging-db.') ||
    hostname.endsWith('.staging.educarelearning.in') ||
    hostname === 'staging-db' ||
    (!isDeployedStaging && isLocal);

  if (!isApprovedStagingHost) {
    console.error(
      `FATAL RECONCILIATION VIOLATION: Database host (${sanitizedTarget}) is not an approved staging server. Database name alone does not authenticate server identity. Apply mode is blocked.`,
    );
    process.exit(1);
  }

  // Require explicit CLI confirmation matching the exact database name
  const confirmArg = argv.find((a) => a.startsWith('--confirm-staging-target='));
  const confirmedDb = confirmArg ? confirmArg.split('=')[1]?.trim() : null;

  if (!confirmedDb || confirmedDb !== database) {
    console.error(
      `FATAL RECONCILIATION VIOLATION: Apply mode requires explicit target confirmation via CLI argument --confirm-staging-target=${database}. Write aborted.`,
    );
    process.exit(1);
  }

  return false; // Apply mode verified
}

if (require.main === module) {
  const dryRun = assertSafeCliReconciliationTarget(process.argv);
  if (dryRun) {
    console.log('Running in DRY-RUN mode by default. Pass --apply and --confirm-staging-target=<db_name> to persist changes.');
  } else {
    console.log('Applying changes to verified staging database based strictly on authoritative origin metadata...');
  }
  reconcileLegacyEnquiries(dryRun, prisma)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during enquiry reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
