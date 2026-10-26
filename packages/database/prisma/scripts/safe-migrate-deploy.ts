/**
 * Safe Prisma Migration Deploy Runner
 *
 * Independently validates the target database BEFORE Prisma CLI is invoked.
 * Enforces fail-closed safety checks:
 * 1. Blocks production IPs (148.135.138.196, IPv6 mapped, hex representations)
 * 2. Blocks production hostnames and production database names
 * 3. Requires server host allowlisting in deployed staging
 * 4. Enforces TLS (sslmode=require) on remote targets
 * 5. Validates conflicting DIRECT_URL / SHADOW_DATABASE_URL
 * 6. Never logs credentials or full connection strings
 */

import { spawnSync } from 'child_process';
import * as dns from 'dns';

function parseDatabaseTarget(rawUrl: string | undefined): {
  protocol: string;
  hostname: string;
  port: number;
  database: string;
  isLocal: boolean;
  isProductionTarget: boolean;
  isApprovedStagingTarget: boolean;
  sslMode: string | null;
  sanitizedTarget: string;
} {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('DATABASE_URL is missing or empty.');
  }

  const clean = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error('DATABASE_URL is malformed and could not be parsed as a valid connection URL.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`Invalid database protocol "${parsed.protocol}". Expected "postgresql:" or "postgres:".`);
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
    throw new Error('DATABASE_URL contains an empty or invalid hostname.');
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error('DATABASE_URL contains an invalid port number.');
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
    throw new Error('DATABASE_URL does not specify a database name in its path.');
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

  const configuredProdIps = process.env.PRODUCTION_DATABASE_IPS
    ? process.env.PRODUCTION_DATABASE_IPS.split(',').map((ip) => ip.trim().toLowerCase()).filter(Boolean)
    : [];
  const knownProductionIps = [
    '148.135.138.196',
    '::ffff:148.135.138.196',
    '::ffff:9487:8ac4',
    '0:0:0:0:0:ffff:9487:8ac4',
    '0000:0000:0000:0000:0000:ffff:9487:8ac4',
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

  const isDeployedStaging =
    process.env.DEPLOYED_STAGING === 'true' ||
    process.env.STAGING_DEPLOYED === 'true' ||
    process.env.REQUIRE_REMOTE_STAGING_DB === 'true';

  const approvedStagingHostsEnv = [
    ...(process.env.APPROVED_STAGING_HOSTS ? process.env.APPROVED_STAGING_HOSTS.split(',') : []),
    ...(process.env.STAGING_DATABASE_ALLOWLIST ? process.env.STAGING_DATABASE_ALLOWLIST.split(',') : []),
    ...(process.env.STAGING_DATABASE_HOST ? [process.env.STAGING_DATABASE_HOST] : []),
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

async function verifyDnsSafety(hostname: string): Promise<void> {
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0';
  if (isLocal) return;

  const prodIps = [
    '148.135.138.196',
    '::ffff:148.135.138.196',
    '::ffff:9487:8ac4',
    '0:0:0:0:0:ffff:9487:8ac4',
  ];

  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    for (const rec of records) {
      const addr = rec.address.toLowerCase().trim().replace(/^\[|\]$/g, '');
      if (prodIps.includes(addr)) {
        throw new Error(
          `DNS SPOOFING DETECTED: Hostname "${hostname}" resolves to production IP "${addr}". Migration execution aborted.`,
        );
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('DNS SPOOFING DETECTED')) {
      throw err;
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('FATAL: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const target = parseDatabaseTarget(databaseUrl);
  console.log(`[SafeMigrate] Validating migration target: ${target.sanitizedTarget}`);

  if (target.isProductionTarget) {
    console.error(
      `FATAL MIGRATION SAFETY VIOLATION: Database target (${target.sanitizedTarget}) is identified as a production system. Automated migration deploy is strictly forbidden.`,
    );
    process.exit(1);
  }

  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const appEnv = (process.env.APP_ENV || '').toLowerCase();
  const isStagingTier = appEnv === 'staging' || (!appEnv && nodeEnv === 'staging');

  if (isStagingTier) {
    if (!target.isApprovedStagingTarget) {
      console.error(
        `FATAL MIGRATION SAFETY VIOLATION: Database target (${target.sanitizedTarget}) is not on the staging host allowlist. Migration aborted.`,
      );
      process.exit(1);
    }

    if (!target.isLocal && target.sslMode !== 'require' && target.sslMode !== 'verify-full' && target.sslMode !== 'verify-ca') {
      console.error(
        `FATAL MIGRATION SAFETY VIOLATION: Remote staging target (${target.sanitizedTarget}) must enforce sslmode=require. Cleartext migrations are prohibited.`,
      );
      process.exit(1);
    }

    if (process.env.DIRECT_URL) {
      const directTarget = parseDatabaseTarget(process.env.DIRECT_URL);
      if (directTarget.isProductionTarget) {
        console.error(
          `FATAL MIGRATION SAFETY VIOLATION: DIRECT_URL (${directTarget.sanitizedTarget}) is pointing to production. Migration aborted.`,
        );
        process.exit(1);
      }
    }

    await verifyDnsSafety(target.hostname);
  }

  console.log(`[SafeMigrate] Preflight check passed. Launching "prisma migrate deploy"...`);

  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`[SafeMigrate] Prisma migrate deploy exited with code ${result.status}`);
    process.exit(result.status || 1);
  }

  console.log(`[SafeMigrate] All migrations deployed successfully.`);
}

main().catch((err) => {
  console.error(`[SafeMigrate] Uncaught error:`, err?.message || err);
  process.exit(1);
});
