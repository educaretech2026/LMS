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

if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  const dryRun = !isApply;
  if (isApply) {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.includes('148.135.138.196') && process.env.ALLOW_PRODUCTION_RECONCILIATION !== 'true') {
      console.error('FATAL SAFETY GUARD: Target database URL points to production host (148.135.138.196). Apply mode is prohibited without explicit ALLOW_PRODUCTION_RECONCILIATION=true confirmation.');
      process.exit(1);
    }
  }
  if (dryRun) {
    console.log('Running in DRY-RUN mode by default. Pass --apply to persist changes.');
  } else {
    console.log('Applying changes to database...');
  }
  reconcileLegacyStudyMaterials(dryRun)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Error during study material reconciliation:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
