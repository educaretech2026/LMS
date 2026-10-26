import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reconcileLegacyStudyMaterials(dryRun: boolean = true, client: any = prisma) {
  console.log(`Starting legacy study material reconciliation (mode: ${dryRun ? 'DRY-RUN' : 'APPLY'})...`);

  // Target records that are neither assigned to a centre nor explicitly designated as shared
  const unassigned = await (client as any).studyMaterial.findMany({
    where: {
      centreId: null,
      isShared: false,
    },
    include: {
      uploader: {
        include: {
          userCentres: true,
          role: true,
        },
      },
      targetTrack: {
        include: {
          batches: true,
        },
      },
    },
  });

  console.log(`Found ${unassigned.length} study materials without an authoritative centreId or explicit shared status.`);

  let trackResolvedCount = 0;
  let uploaderResolvedCount = 0;
  const ambiguousRecords: Array<{
    materialId: string;
    title: string;
    uploaderId: string | null;
    uploaderRole?: string;
    reason: string;
  }> = [];

  for (const material of unassigned) {
    // 1. Check target track batch linkages
    const trackBatches = material.targetTrack?.batches || [];
    const trackCentres = Array.from(
      new Set(trackBatches.map((b: any) => b.centreId).filter(Boolean)),
    ) as string[];

    if (trackCentres.length === 1) {
      trackResolvedCount++;
      if (!dryRun) {
        await (client as any).studyMaterial.update({
          where: { id: material.id },
          data: { centreId: trackCentres[0] },
        });
      }
      continue;
    }

    if (trackCentres.length > 1) {
      ambiguousRecords.push({
        materialId: material.id,
        title: material.title,
        uploaderId: material.uploaderId,
        uploaderRole: material.uploader?.role?.name,
        reason:
          'Target track spans batches across multiple centres; cannot infer a single authoritative centre. Requires manual review.',
      });
      continue;
    }

    // 2. No target track or track has no batches: check uploader
    const uploaderRole = material.uploader?.role?.name;
    if (uploaderRole === 'SUPER_ADMIN') {
      ambiguousRecords.push({
        materialId: material.id,
        title: material.title,
        uploaderId: material.uploaderId,
        uploaderRole,
        reason:
          'Uploaded by Super Admin without track or centre. Requires manual admin designation: either set isShared=true for global content or assign to a specific centre.',
      });
      continue;
    }

    const uploaderCentres = Array.from(
      new Set((material.uploader?.userCentres || []).map((uc: any) => uc.centreId).filter(Boolean)),
    ) as string[];

    if (uploaderCentres.length === 1) {
      uploaderResolvedCount++;
      if (!dryRun) {
        await (client as any).studyMaterial.update({
          where: { id: material.id },
          data: { centreId: uploaderCentres[0] },
        });
      }
    } else {
      ambiguousRecords.push({
        materialId: material.id,
        title: material.title,
        uploaderId: material.uploaderId,
        uploaderRole,
        reason:
          uploaderCentres.length > 1
            ? 'Uploader belongs to multiple centres; cannot unambiguously infer material centre ownership without manual review.'
            : 'Uploader has no centre memberships; cannot infer centre scope.',
      });
    }
  }

  const totalResolved = trackResolvedCount + uploaderResolvedCount;

  console.log('--- Study Material Reconciliation Summary ---');
  console.log(`Total Inspected: ${unassigned.length}`);
  console.log(`Resolved via Unambiguous Target Track Centre: ${trackResolvedCount}`);
  console.log(`Resolved via Unambiguous Uploader Centre: ${uploaderResolvedCount}`);
  console.log(`Total Resolved: ${totalResolved}`);
  console.log(`Ambiguous (Failing Closed for Safety): ${ambiguousRecords.length}`);

  if (ambiguousRecords.length > 0) {
    console.warn('⚠️ The following study materials could not be safely resolved and remain un-scoped (failing closed):');
    console.table(ambiguousRecords);
  }

  return {
    total: unassigned.length,
    resolvedCount: totalResolved,
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
    console.log('Applying changes to verified staging database...');
  }
  reconcileLegacyStudyMaterials(dryRun)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during study material reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
