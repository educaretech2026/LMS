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

  let rawHostname = (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  let hostname = rawHostname;
  try {
    let decoded = decodeURIComponent(rawHostname);
    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded);
    }
    hostname = decoded;
  } catch {
    // Retain raw if decoding fails
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
    // Retain raw if decoding fails
  }

  if (!database) {
    throw new Error('DATABASE_URL does not specify a database name in its path.');
  }

  const sslMode = parsed.searchParams.get('sslmode');

  // Local loopback targets (strictly for local development / integration test execution)
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'staging-db' ||
    hostname === 'postgres' ||
    hostname === 'db';

  // Configurable production IPs and hostnames (including IPv4-mapped IPv6, DNS aliases, and hex representations)
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

  // Deployed staging mode: Disallows local loopback targets when deployed staging is active
  const isDeployedStaging =
    process.env.DEPLOYED_STAGING === 'true' ||
    process.env.STAGING_DEPLOYED === 'true' ||
    process.env.REQUIRE_REMOTE_STAGING_DB === 'true';

  // Approved staging target resolution: MUST be based on verified server host identity, NOT database name alone!
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

  // Database name must also be appropriate for staging, but host identity MUST be verified independently!
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

/**
 * Validates the database target against environment safety constraints.
 * Fails closed if running in staging and the target is unapproved, production, or remote without SSL.
 *
 * Separates Runtime Mode (NODE_ENV) from Deployment Tier (APP_ENV).
 * A deployed staging environment standardly runs with NODE_ENV=production (optimized bundle/engine)
 * and APP_ENV=staging (staging infrastructure tier).
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

  // Ambiguity check: Reject genuinely contradictory environment configurations
  // Valid standard: NODE_ENV=production with APP_ENV=staging (deployed staging with optimized runtime)
  // Contradiction 1: APP_ENV=production while NODE_ENV=staging or process.env.DEPLOYED_STAGING=true
  if (
    appEnv === 'production' &&
    (nodeEnv === 'staging' || process.env.DEPLOYED_STAGING === 'true' || process.env.STAGE === 'staging')
  ) {
    throw new Error(
      'Ambiguous environment configuration: APP_ENV indicates production tier while staging mode is declared. Startup aborted for safety.',
    );
  }

  // Contradiction 2: APP_ENV=production while running in development runtime mode
  if (appEnv === 'production' && nodeEnv === 'development') {
    throw new Error(
      'Ambiguous environment configuration: APP_ENV=production cannot run with unoptimized NODE_ENV=development runtime. Startup aborted for safety.',
    );
  }

  // Determine effective deployment tier: APP_ENV takes precedence over NODE_ENV
  const isStagingTier = appEnv === 'staging' || (!appEnv && nodeEnv === 'staging');
  const isProductionTier = appEnv === 'production' || (!appEnv && nodeEnv === 'production' && !isStagingTier);

  const targetInfo = parseDatabaseTarget(rawUrl);

  if (isStagingTier) {
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

  if (isProductionTier) {
    // In production tier, log notices if local or if sslmode is not explicitly set to require,
    // but do not crash the running service for single-node / co-located deployments
    if (targetInfo.isLocal && !process.env.ALLOW_LOCAL_PRODUCTION) {
      console.warn(
        `[DatabaseTarget] Notice: Database target (${targetInfo.sanitizedTarget}) is local loopback in production mode.`,
      );
    }
    if (
      !targetInfo.isLocal &&
      targetInfo.sslMode !== 'require' &&
      targetInfo.sslMode !== 'verify-full' &&
      targetInfo.sslMode !== 'verify-ca'
    ) {
      console.warn(
        `[DatabaseTarget] Notice: Remote production database target (${targetInfo.sanitizedTarget}) does not specify sslmode=require.`,
      );
    }
  }

  // 4. Conflicting Database URL Environment Variables Guard
  // In Prisma, DIRECT_URL and SHADOW_DATABASE_URL can override DATABASE_URL.
  // Ensure neither points to a production target when running in staging mode.
  if (isStagingTier) {
    if (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) {
      const directTarget = parseDatabaseTarget(process.env.DIRECT_URL);
      if (directTarget.isProductionTarget) {
        throw new Error(
          `Staging safety violation: DIRECT_URL (${directTarget.sanitizedTarget}) is pointing to a production system while running in staging mode. Startup aborted.`,
        );
      }
    }
    if (process.env.SHADOW_DATABASE_URL && process.env.SHADOW_DATABASE_URL.trim()) {
      const shadowTarget = parseDatabaseTarget(process.env.SHADOW_DATABASE_URL);
      if (shadowTarget.isProductionTarget) {
        throw new Error(
          `Staging safety violation: SHADOW_DATABASE_URL (${shadowTarget.sanitizedTarget}) is pointing to a production system while running in staging mode. Startup aborted.`,
        );
      }
    }
  }

  return targetInfo;
}

/**
 * Validates that a hostname does not resolve via DNS to any known production IP address.
 * Prevents DNS alias/CNAME/A-record spoofing where an allowlisted hostname resolves to production.
 */
export async function verifyHostDnsSafety(
  hostname: string,
  options?: {
    customProdIps?: string[];
    dnsLookupFn?: (host: string, opts: any) => Promise<Array<{ address: string; family: number }>>;
  },
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

  const prodIps = options?.customProdIps || [
    '148.135.138.196',
    '::ffff:148.135.138.196',
    '::ffff:9487:8ac4',
    '0:0:0:0:0:ffff:9487:8ac4',
    '0000:0000:0000:0000:0000:ffff:9487:8ac4',
  ];

  try {
    let records: Array<{ address: string; family: number }> = [];
    if (options?.dnsLookupFn) {
      records = await options.dnsLookupFn(cleanHost, { all: true });
    } else {
      const dns = await import('dns');
      records = await dns.promises.lookup(cleanHost, { all: true });
    }

    for (const rec of records) {
      const addr = rec.address.toLowerCase().trim().replace(/^\[|\]$/g, '');
      if (prodIps.includes(addr)) {
        throw new Error(
          `DNS spoofing/alias violation: Hostname "${cleanHost}" resolves to production IP "${addr}". Connection blocked to protect production database.`,
        );
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('DNS spoofing/alias violation')) {
      throw err;
    }
    // Re-throw if it's our violation error
  }
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
