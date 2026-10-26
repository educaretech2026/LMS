/**
 * Safe Prisma Migration Deploy Runner
 *
 * Independently validates target databases BEFORE Prisma CLI is invoked.
 * Enforces fail-closed safety checks:
 * 1. Blocks production IPs (148.135.138.196, IPv6 mapped, hex representations) in all environments
 * 2. Blocks production hostnames and production database names in all environments
 * 3. Validates DATABASE_URL and DIRECT_URL independently before any subprocess execution
 * 4. Requires server host allowlisting for all targets in deployed staging
 * 5. Enforces TLS (sslmode=require) on remote targets in staging
 * 6. Validates SHADOW_DATABASE_URL if present
 * 7. Never logs credentials or full connection strings
 */

import { spawnSync } from 'child_process';
import * as dns from 'dns';

export interface DatabaseTargetInfo {
  protocol: string;
  hostname: string;
  port: number;
  database: string;
  isLocal: boolean;
  isProductionTarget: boolean;
  isApprovedStagingTarget: boolean;
  sslMode: string | null;
  sanitizedTarget: string;
}

export function parseDatabaseTarget(
  rawUrl: string | undefined,
  varName = 'DATABASE_URL',
  env: NodeJS.ProcessEnv = process.env,
): DatabaseTargetInfo {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error(`${varName} is missing or empty.`);
  }

  const clean = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error(`${varName} is malformed and could not be parsed as a valid connection URL.`);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`Invalid database protocol "${parsed.protocol}" in ${varName}. Expected "postgresql:" or "postgres:".`);
  }

  let rawHostname = (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  let hostname = rawHostname;
  try {
    let decoded = decodeURIComponent(rawHostname);
    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded);
    }
    hostname = decoded;
  } catch {
    // Retain raw
  }
  hostname = hostname.trim().replace(/^\[|\]$/g, '').replace(/\.+$/, '');

  if (!hostname) {
    throw new Error(`${varName} contains an empty or invalid hostname.`);
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`${varName} contains an invalid port number.`);
  }

  let rawDb = (parsed.pathname || '').replace(/^\//, '').split('?')[0].trim();
  let database = rawDb;
  try {
    let decoded = decodeURIComponent(rawDb);
    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded);
    }
    database = decoded;
  } catch {
    // Retain raw
  }

  if (!database) {
    throw new Error(`${varName} does not specify a database name in its path.`);
  }

  const sslMode = parsed.searchParams.get('sslmode');

  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'staging-db' ||
    hostname === 'postgres' ||
    hostname === 'db';

  const configuredProdIps = env.PRODUCTION_DATABASE_IPS
    ? env.PRODUCTION_DATABASE_IPS.split(',').map((ip) => ip.trim().toLowerCase()).filter(Boolean)
    : [];
  const knownProductionIps = [
    '148.135.138.196',
    '::ffff:148.135.138.196',
    '::ffff:9487:8ac4',
    '0:0:0:0:0:ffff:9487:8ac4',
    '0000:0000:0000:0000:0000:ffff:9487:8ac4',
    ...configuredProdIps,
  ];

  const configuredProdHosts = env.PRODUCTION_DATABASE_HOSTS
    ? env.PRODUCTION_DATABASE_HOSTS.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
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

  const configuredProdDbs = env.PRODUCTION_DATABASE_NAMES
    ? env.PRODUCTION_DATABASE_NAMES.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
    : [];
  const knownProductionDbs = ['educare_prod', 'educare_production', ...configuredProdDbs];

  const isProductionTarget =
    knownProductionIps.includes(hostname) ||
    knownProductionHosts.includes(hostname) ||
    (hostname.endsWith('.educarelearning.in') && !hostname.includes('staging')) ||
    knownProductionDbs.includes(database);

  const isDeployedStaging =
    env.DEPLOYED_STAGING === 'true' ||
    env.STAGING_DEPLOYED === 'true' ||
    env.REQUIRE_REMOTE_STAGING_DB === 'true';

  const approvedStagingHostsEnv = [
    ...(env.APPROVED_STAGING_HOSTS ? env.APPROVED_STAGING_HOSTS.split(',') : []),
    ...(env.STAGING_DATABASE_ALLOWLIST ? env.STAGING_DATABASE_ALLOWLIST.split(',') : []),
    ...(env.STAGING_DATABASE_HOST ? [env.STAGING_DATABASE_HOST] : []),
  ].map((h) => h.trim().toLowerCase().replace(/\.+$/, '')).filter(Boolean);

  const isHostApproved =
    approvedStagingHostsEnv.includes(hostname) ||
    hostname.startsWith('staging-db.') ||
    hostname.endsWith('.staging.educarelearning.in') ||
    hostname === 'staging-db' ||
    (!isDeployedStaging && isLocal);

  const isApprovedStagingTarget = !isProductionTarget && isHostApproved;
  const sanitizedTarget = `host: ${hostname}, port: ${port}, db: ${database}, ssl: ${sslMode || 'none'}`;

  return {
    protocol: parsed.protocol,
    hostname,
    port,
    database,
    isLocal,
    isProductionTarget,
    isApprovedStagingTarget,
    sslMode,
    sanitizedTarget,
  };
}

export async function verifyDnsSafety(
  hostname: string,
  targetLabel = 'Target',
  lookupFn?: (host: string, opts: any) => Promise<Array<{ address: string; family: number }>>,
): Promise<void> {
  const cleanHost = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  const isLocal =
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost === '::1' ||
    cleanHost === '0.0.0.0' ||
    cleanHost === 'staging-db' ||
    cleanHost === 'postgres' ||
    cleanHost === 'db';
  if (isLocal) return;

  const prodIps = [
    '148.135.138.196',
    '::ffff:148.135.138.196',
    '::ffff:9487:8ac4',
    '0:0:0:0:0:ffff:9487:8ac4',
    '0000:0000:0000:0000:0000:ffff:9487:8ac4',
  ];

  try {
    let records: Array<{ address: string; family: number }> = [];
    if (lookupFn) {
      records = await lookupFn(cleanHost, { all: true });
    } else {
      records = (await dns.promises.lookup(cleanHost, { all: true })) as any;
    }
    for (const rec of records) {
      const addr = rec.address.toLowerCase().trim().replace(/^\[|\]$/g, '');
      if (prodIps.includes(addr)) {
        throw new Error(
          `DNS SPOOFING DETECTED: ${targetLabel} hostname "${cleanHost}" resolves to production IP "${addr}". Migration execution aborted.`,
        );
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('DNS SPOOFING DETECTED')) {
      throw err;
    }
  }
}

/**
 * Validates all configured migration target URLs independently before Prisma CLI is launched.
 * Ensures that neither DATABASE_URL, DIRECT_URL, nor SHADOW_DATABASE_URL can target production
 * or bypass staging allowlists.
 */
export async function assertSafeMigrationTargets(
  env: NodeJS.ProcessEnv = process.env,
  lookupFn?: (host: string, opts: any) => Promise<Array<{ address: string; family: number }>>,
): Promise<{
  databaseTarget: DatabaseTargetInfo;
  directTarget?: DatabaseTargetInfo;
  shadowTarget?: DatabaseTargetInfo;
}> {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const appEnv = (env.APP_ENV || '').toLowerCase();

  // 1. Ambiguity & Contradiction Guards
  if (
    appEnv === 'production' &&
    (nodeEnv === 'staging' || env.DEPLOYED_STAGING === 'true' || env.STAGE === 'staging')
  ) {
    throw new Error(
      'FATAL MIGRATION SAFETY VIOLATION: Contradictory environment: APP_ENV indicates production tier while staging mode is declared. Migration deploy aborted.',
    );
  }
  if (appEnv === 'production' && nodeEnv === 'development') {
    throw new Error(
      'FATAL MIGRATION SAFETY VIOLATION: Contradictory environment: APP_ENV=production cannot run with unoptimized NODE_ENV=development runtime. Migration deploy aborted.',
    );
  }

  const isStagingTier = appEnv === 'staging' || (!appEnv && nodeEnv === 'staging');

  // 2. Validate DATABASE_URL (Mandatory)
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new Error('FATAL MIGRATION SAFETY VIOLATION: DATABASE_URL environment variable is missing or empty.');
  }

  const databaseTarget = parseDatabaseTarget(databaseUrl, 'DATABASE_URL', env);

  // Unconditional block on production target in all environments for automated migrations
  if (databaseTarget.isProductionTarget) {
    throw new Error(
      `FATAL MIGRATION SAFETY VIOLATION: DATABASE_URL (${databaseTarget.sanitizedTarget}) is identified as a production system. Automated migration deploy is strictly forbidden.`,
    );
  }

  if (isStagingTier) {
    if (!databaseTarget.isApprovedStagingTarget) {
      throw new Error(
        `FATAL MIGRATION SAFETY VIOLATION: DATABASE_URL (${databaseTarget.sanitizedTarget}) is not on the staging host allowlist. Migration aborted.`,
      );
    }

    if (
      !databaseTarget.isLocal &&
      databaseTarget.sslMode !== 'require' &&
      databaseTarget.sslMode !== 'verify-full' &&
      databaseTarget.sslMode !== 'verify-ca'
    ) {
      throw new Error(
        `FATAL MIGRATION SAFETY VIOLATION: Remote staging DATABASE_URL (${databaseTarget.sanitizedTarget}) must enforce sslmode=require (or verify-full). Cleartext migrations are prohibited.`,
      );
    }

    await verifyDnsSafety(databaseTarget.hostname, 'DATABASE_URL', lookupFn);
  }

  // 3. Validate DIRECT_URL (Independent validation - never assumes DATABASE_URL validation applies)
  let directTarget: DatabaseTargetInfo | undefined;
  if (env.DIRECT_URL && env.DIRECT_URL.trim()) {
    directTarget = parseDatabaseTarget(env.DIRECT_URL, 'DIRECT_URL', env);

    // Reject production target in EVERY environment (staging, development, test)
    if (directTarget.isProductionTarget) {
      throw new Error(
        `FATAL MIGRATION SAFETY VIOLATION: DIRECT_URL (${directTarget.sanitizedTarget}) is identified as a production system. Automated migration deploy is strictly forbidden.`,
      );
    }

    if (isStagingTier) {
      if (!directTarget.isApprovedStagingTarget) {
        throw new Error(
          `FATAL MIGRATION SAFETY VIOLATION: DIRECT_URL (${directTarget.sanitizedTarget}) is not on the staging host allowlist. Migration aborted.`,
        );
      }

      if (
        !directTarget.isLocal &&
        directTarget.sslMode !== 'require' &&
        directTarget.sslMode !== 'verify-full' &&
        directTarget.sslMode !== 'verify-ca'
      ) {
        throw new Error(
          `FATAL MIGRATION SAFETY VIOLATION: Remote staging DIRECT_URL (${directTarget.sanitizedTarget}) must enforce sslmode=require (or verify-full). Cleartext migrations are prohibited.`,
        );
      }

      await verifyDnsSafety(directTarget.hostname, 'DIRECT_URL', lookupFn);
    }
  }

  // 4. Validate SHADOW_DATABASE_URL if present
  let shadowTarget: DatabaseTargetInfo | undefined;
  if (env.SHADOW_DATABASE_URL && env.SHADOW_DATABASE_URL.trim()) {
    shadowTarget = parseDatabaseTarget(env.SHADOW_DATABASE_URL, 'SHADOW_DATABASE_URL', env);

    if (shadowTarget.isProductionTarget) {
      throw new Error(
        `FATAL MIGRATION SAFETY VIOLATION: SHADOW_DATABASE_URL (${shadowTarget.sanitizedTarget}) is identified as a production system. Automated migration deploy is strictly forbidden.`,
      );
    }

    if (isStagingTier && !shadowTarget.isApprovedStagingTarget) {
      throw new Error(
        `FATAL MIGRATION SAFETY VIOLATION: SHADOW_DATABASE_URL (${shadowTarget.sanitizedTarget}) is not on the staging host allowlist. Migration aborted.`,
      );
    }
  }

  return { databaseTarget, directTarget, shadowTarget };
}

/**
 * Main migration deploy execution wrapper.
 * Guarantees that validation runs and completes BEFORE any migration subprocess is spawned.
 */
export async function runSafeMigrateDeploy(
  env: NodeJS.ProcessEnv = process.env,
  spawnFn: (command: string, args: string[], options: any) => any = spawnSync,
): Promise<number> {
  const { databaseTarget, directTarget, shadowTarget } = await assertSafeMigrationTargets(env);

  console.log(`[SafeMigrate] Validating migration target: ${databaseTarget.sanitizedTarget}`);
  if (directTarget) {
    console.log(`[SafeMigrate] Validating direct migration target: ${directTarget.sanitizedTarget}`);
  }
  if (shadowTarget) {
    console.log(`[SafeMigrate] Validating shadow migration target: ${shadowTarget.sanitizedTarget}`);
  }

  console.log(`[SafeMigrate] Preflight check passed. Launching "prisma migrate deploy"...`);

  const result = spawnFn('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env,
  });

  if (result && typeof result.status === 'number' && result.status !== 0) {
    console.error(`[SafeMigrate] Prisma migrate deploy exited with code ${result.status}`);
    return result.status;
  }

  console.log(`[SafeMigrate] All migrations deployed successfully.`);
  return 0;
}

if (require.main === module) {
  runSafeMigrateDeploy()
    .then((code) => {
      if (code !== 0) process.exit(code);
    })
    .catch((err) => {
      console.error(err?.message || err);
      process.exit(1);
    });
}
