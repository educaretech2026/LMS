/**
 * Database Target & Environment Safety Validator
 *
 * Enforces fail-closed target verification for staging and production environments.
 * Rejects production hosts, unapproved staging hosts, remote cleartext connections,
 * and ambiguous environment definitions before opening database connections.
 * Never logs credentials or full connection strings.
 */

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

/**
 * Parses a raw database URL and extracts normalized, sanitized connection metadata.
 * Strips user and password credentials completely.
 */
export function parseDatabaseTarget(rawUrl: string | undefined): DatabaseTargetInfo {
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

  const hostname = (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new Error('DATABASE_URL contains an empty or invalid hostname.');
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error('DATABASE_URL contains an invalid port number.');
  }

  const database = (parsed.pathname || '').replace(/^\//, '').split('?')[0].trim();
  if (!database) {
    throw new Error('DATABASE_URL does not specify a database name in its path.');
  }

  const sslMode = parsed.searchParams.get('sslmode');

  // Local/container loopback targets
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'staging-db' ||
    hostname === 'postgres' ||
    hostname === 'db';

  // Known production IPs and hostnames
  const knownProductionIps = ['148.135.138.196'];
  const knownProductionHosts = [
    'api.educarelearning.in',
    'db.educarelearning.in',
    'database.educarelearning.in',
    'postgres.educarelearning.in',
    'lms.educarelearning.in',
    'prod-db.educarelearning.in',
    'prod.educarelearning.in',
  ];

  const isProductionTarget =
    knownProductionIps.includes(hostname) ||
    knownProductionHosts.includes(hostname) ||
    (hostname.includes('educarelearning.in') && !hostname.includes('staging')) ||
    database === 'educare_prod' ||
    database === 'educare_production';

  // Approved staging target resolution
  const approvedStagingHostsEnv = process.env.APPROVED_STAGING_HOSTS
    ? process.env.APPROVED_STAGING_HOSTS.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    : [];

  const isApprovedStagingTarget =
    !isProductionTarget &&
    (isLocal ||
      approvedStagingHostsEnv.includes(hostname) ||
      hostname.includes('staging') ||
      database.includes('staging') ||
      database === 'educare_db' ||
      database === 'test_educare');

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

/**
 * Validates the database target against environment safety constraints.
 * Fails closed if running in staging and the target is unapproved, production, or remote without SSL.
 */
export function assertValidTargetForEnvironment(
  rawUrl: string | undefined,
  envOptions?: {
    nodeEnv?: string;
    appEnv?: string;
  },
): DatabaseTargetInfo {
  const nodeEnv = (envOptions?.nodeEnv ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  const appEnv = (envOptions?.appEnv ?? process.env.APP_ENV ?? '').toLowerCase();

  // Ambiguity check: Conflicting environment definitions
  if (
    (nodeEnv === 'production' && appEnv === 'staging') ||
    (nodeEnv === 'staging' && appEnv === 'production')
  ) {
    throw new Error(
      'Ambiguous environment configuration: NODE_ENV and APP_ENV conflict (one is production, one is staging). Startup aborted for safety.',
    );
  }

  const isProduction = nodeEnv === 'production' || appEnv === 'production';
  const isStaging = nodeEnv === 'staging' || appEnv === 'staging';

  const targetInfo = parseDatabaseTarget(rawUrl);

  if (isStaging) {
    // 1. Must NOT be a production target
    if (targetInfo.isProductionTarget) {
      throw new Error(
        `Staging safety violation: Database target (${targetInfo.sanitizedTarget}) is identified as a production system. Staging cannot connect to production.`,
      );
    }

    // 2. Must be an approved staging target (fail-closed on unknown host)
    if (!targetInfo.isApprovedStagingTarget) {
      throw new Error(
        `Staging safety violation: Database target (${targetInfo.sanitizedTarget}) is not on the staging host/database allowlist. Startup aborted.`,
      );
    }

    // 3. Remote staging targets must enforce TLS
    if (
      !targetInfo.isLocal &&
      targetInfo.sslMode !== 'require' &&
      targetInfo.sslMode !== 'verify-full' &&
      targetInfo.sslMode !== 'verify-ca'
    ) {
      throw new Error(
        `Staging safety violation: Remote staging database target (${targetInfo.sanitizedTarget}) must specify sslmode=require (or verify-full). Cleartext connections are prohibited.`,
      );
    }
  }

  if (isProduction) {
    // In production, loopback/local is not permitted unless explicit dev override
    if (targetInfo.isLocal && !process.env.ALLOW_LOCAL_PRODUCTION) {
      throw new Error(
        `Production safety violation: Database target (${targetInfo.sanitizedTarget}) is pointing to localhost in production mode.`,
      );
    }
    // Remote production must enforce TLS
    if (
      !targetInfo.isLocal &&
      targetInfo.sslMode !== 'require' &&
      targetInfo.sslMode !== 'verify-full' &&
      targetInfo.sslMode !== 'verify-ca'
    ) {
      throw new Error(
        `Production safety violation: Remote production database target (${targetInfo.sanitizedTarget}) must specify sslmode=require (or verify-full).`,
      );
    }
  }

  return targetInfo;
}

/**
 * Validates CLI script reconciliation targets.
 * Completely blocks all writes to production targets and requires explicit
 * --confirm-staging-target=<db_name> parameter for staging apply writes.
 */
export function assertSafeReconciliationTarget(
  rawUrl: string | undefined,
  argv: string[],
): { dryRun: boolean; targetInfo: DatabaseTargetInfo } {
  const isApply = argv.includes('--apply');
  const dryRun = !isApply;

  const targetInfo = parseDatabaseTarget(rawUrl);

  if (isApply) {
    // 1. Unconditional Block on Production Targets
    if (targetInfo.isProductionTarget) {
      throw new Error(
        `FATAL RECONCILIATION VIOLATION: Database target (${targetInfo.sanitizedTarget}) is a production system. Automatic reconciliation script mutations are strictly prohibited on production databases. Use authenticated Super Admin API workflows.`,
      );
    }

    // 2. Must be verified staging target
    if (!targetInfo.isApprovedStagingTarget) {
      throw new Error(
        `FATAL RECONCILIATION VIOLATION: Database target (${targetInfo.sanitizedTarget}) is not an approved staging database. Apply mode is blocked.`,
      );
    }

    // 3. Require explicit CLI target confirmation matching the exact database name
    const confirmArg = argv.find((a) => a.startsWith('--confirm-staging-target='));
    const confirmedDb = confirmArg ? confirmArg.split('=')[1]?.trim() : null;

    if (!confirmedDb || confirmedDb !== targetInfo.database) {
      throw new Error(
        `FATAL RECONCILIATION VIOLATION: Apply mode requires explicit target confirmation via CLI argument --confirm-staging-target=${targetInfo.database}. Staging write aborted.`,
      );
    }
  }

  return { dryRun, targetInfo };
}
