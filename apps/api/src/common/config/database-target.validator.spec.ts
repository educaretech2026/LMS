import {
  parseDatabaseTarget,
  assertValidTargetForEnvironment,
  assertSafeReconciliationTarget,
  verifyHostDnsSafety,
} from './database-target.validator';

describe('Database Target & Environment Safety Validator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.NODE_ENV;
    delete process.env.APP_ENV;
    delete process.env.APPROVED_STAGING_HOSTS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. URL Parsing & Sanitization', () => {
    it('should correctly parse a valid postgres URL and strip credentials from sanitized output', () => {
      const url = 'postgresql://admin_user:SuperSecretPassword123!@127.0.0.1:5433/educare_staging?sslmode=require';
      const result = parseDatabaseTarget(url);

      expect(result.protocol).toBe('postgresql:');
      expect(result.hostname).toBe('127.0.0.1');
      expect(result.port).toBe(5433);
      expect(result.database).toBe('educare_staging');
      expect(result.sslMode).toBe('require');
      expect(result.isLocal).toBe(true);

      // Verify credentials are not in sanitized output
      expect(result.sanitizedTarget).not.toContain('admin_user');
      expect(result.sanitizedTarget).not.toContain('SuperSecretPassword123!');
      expect(result.sanitizedTarget).toBe('host: 127.0.0.1, port: 5433, db: educare_staging, ssl: require');
    });

    it('should reject missing or empty DATABASE_URL', () => {
      expect(() => parseDatabaseTarget('')).toThrow('DATABASE_URL is missing or empty.');
      expect(() => parseDatabaseTarget(undefined)).toThrow('DATABASE_URL is missing or empty.');
    });

    it('should reject malformed URLs that cannot be parsed', () => {
      expect(() => parseDatabaseTarget('not-a-valid-url')).toThrow('DATABASE_URL is malformed');
      expect(() => parseDatabaseTarget('http://')).toThrow('DATABASE_URL is malformed');
      expect(() => parseDatabaseTarget('postgresql:///dbname')).toThrow('DATABASE_URL contains an empty or invalid hostname.');
    });

    it('should reject non-postgresql protocols', () => {
      expect(() => parseDatabaseTarget('mysql://user:pass@localhost:3306/db')).toThrow(
        'Invalid database protocol "mysql:". Expected "postgresql:" or "postgres:".',
      );
      expect(() => parseDatabaseTarget('sqlite:///path/to/db.sqlite')).toThrow(
        'Invalid database protocol "sqlite:".',
      );
    });

    it('should reject URLs without a database path', () => {
      expect(() => parseDatabaseTarget('postgresql://user:pass@localhost:5432/')).toThrow(
        'DATABASE_URL does not specify a database name in its path.',
      );
      expect(() => parseDatabaseTarget('postgresql://user:pass@localhost:5432')).toThrow(
        'DATABASE_URL does not specify a database name in its path.',
      );
    });
  });

  describe('2. Staging Target Verification & Production Isolation', () => {
    it('should REJECT production IP (148.135.138.196) in staging mode', () => {
      const prodUrl = 'postgresql://educare:Secret123@148.135.138.196:5432/postgres';
      expect(() =>
        assertValidTargetForEnvironment(prodUrl, { nodeEnv: 'staging' }),
      ).toThrow(/identified as a production system/);
      expect(() =>
        assertValidTargetForEnvironment(prodUrl, { appEnv: 'staging' }),
      ).toThrow(/identified as a production system/);
    });

    it('should REJECT known production hostnames in staging mode', () => {
      const prodHosts = [
        'api.educarelearning.in',
        'db.educarelearning.in',
        'database.educarelearning.in',
        'postgres.educarelearning.in',
        'lms.educarelearning.in',
      ];

      for (const host of prodHosts) {
        const url = `postgresql://educare:Secret123@${host}:5432/educare_db?sslmode=require`;
        expect(() =>
          assertValidTargetForEnvironment(url, { nodeEnv: 'staging' }),
        ).toThrow(/identified as a production system/);
      }
    });

    it('should REJECT production database names (educare_prod, educare_production)', () => {
      const url = 'postgresql://educare:Secret123@staging-db.educare.internal:5432/educare_prod?sslmode=require';
      expect(() =>
        assertValidTargetForEnvironment(url, { nodeEnv: 'staging' }),
      ).toThrow(/identified as a production system/);
    });

    it('should REJECT unapproved arbitrary remote targets in staging (fail-closed)', () => {
      // Remote host not in allowlist and without staging identity
      const url = 'postgresql://user:Secret123@192.0.2.55:5432/random_db?sslmode=require';
      expect(() =>
        assertValidTargetForEnvironment(url, { nodeEnv: 'staging' }),
      ).toThrow(/not on the staging host\/database allowlist/);
    });

    it('should REJECT remote staging targets if sslmode=require is omitted', () => {
      const cleartextUrl = 'postgresql://user:Secret123@staging-db.educarelearning.in:5432/educare_staging';
      expect(() =>
        assertValidTargetForEnvironment(cleartextUrl, { nodeEnv: 'staging' }),
      ).toThrow(/must specify sslmode=require/);
    });

    it('should ALLOW approved remote staging targets with sslmode=require', () => {
      const stagingUrl =
        'postgresql://user:Secret123@staging-db.educarelearning.in:5432/educare_staging?sslmode=require';
      const result = assertValidTargetForEnvironment(stagingUrl, { nodeEnv: 'staging' });
      expect(result.isApprovedStagingTarget).toBe(true);
      expect(result.isProductionTarget).toBe(false);
    });

    it('should ALLOW verified local loopback targets in staging', () => {
      const localTargets = [
        'postgresql://educare:pass@localhost:5433/educare_db',
        'postgresql://educare:pass@127.0.0.1:5433/educare_db',
        'postgresql://educare:pass@127.0.0.1:5432/educare_staging',
        'postgresql://educare:pass@staging-db:5432/educare_db',
      ];

      for (const target of localTargets) {
        const result = assertValidTargetForEnvironment(target, { nodeEnv: 'staging' });
        expect(result.isApprovedStagingTarget).toBe(true);
        expect(result.isLocal).toBe(true);
      }
    });

    it('should REJECT unapproved arbitrary host even if database is named educare_staging or educare_db (database name is NOT proof of server identity)', () => {
      const urlWithStagingDbName =
        'postgresql://user:Secret123@198.51.100.25:5432/educare_staging?sslmode=require';
      expect(() =>
        assertValidTargetForEnvironment(urlWithStagingDbName, { nodeEnv: 'staging' }),
      ).toThrow(/not on the staging host\/database allowlist/);

      const urlWithEducareDbName =
        'postgresql://user:Secret123@198.51.100.25:5432/educare_db?sslmode=require';
      expect(() =>
        assertValidTargetForEnvironment(urlWithEducareDbName, { nodeEnv: 'staging' }),
      ).toThrow(/not on the staging host\/database allowlist/);
    });

    it('should REJECT localhost/loopback when DEPLOYED_STAGING=true is active', () => {
      process.env.DEPLOYED_STAGING = 'true';
      const localUrl = 'postgresql://educare:pass@127.0.0.1:5433/educare_staging?sslmode=require';
      expect(() =>
        assertValidTargetForEnvironment(localUrl, { nodeEnv: 'staging' }),
      ).toThrow(/not on the staging host\/database allowlist/);
    });

    it('should REJECT alternate production addresses (IPv4-mapped IPv6, custom PRODUCTION_DATABASE_IPS, custom PRODUCTION_DATABASE_HOSTS)', () => {
      // IPv4-mapped IPv6
      const ipv6MappedProd = 'postgresql://educare:Secret123@[::ffff:148.135.138.196]:5432/postgres';
      expect(() =>
        assertValidTargetForEnvironment(ipv6MappedProd, { nodeEnv: 'staging' }),
      ).toThrow(/identified as a production system/);

      // Custom production IP
      process.env.PRODUCTION_DATABASE_IPS = '203.0.113.88';
      const customProdIpUrl = 'postgresql://educare:Secret123@203.0.113.88:5432/app_db';
      expect(() =>
        assertValidTargetForEnvironment(customProdIpUrl, { nodeEnv: 'staging' }),
      ).toThrow(/identified as a production system/);

      // Custom production host
      process.env.PRODUCTION_DATABASE_HOSTS = 'rds-primary.internal.educare';
      const customProdHostUrl = 'postgresql://educare:Secret123@rds-primary.internal.educare:5432/app_db';
      expect(() =>
        assertValidTargetForEnvironment(customProdHostUrl, { nodeEnv: 'staging' }),
      ).toThrow(/identified as a production system/);
    });

    it('should ALLOW standard deployed staging configuration (NODE_ENV=production with APP_ENV=staging)', () => {
      const stagingUrl =
        'postgresql://user:Secret123@staging-db.educarelearning.in:5432/educare_staging?sslmode=require';
      const result = assertValidTargetForEnvironment(stagingUrl, {
        nodeEnv: 'production',
        appEnv: 'staging',
      });
      expect(result.isApprovedStagingTarget).toBe(true);
      expect(result.isProductionTarget).toBe(false);
    });

    it('should REJECT genuinely contradictory environment settings', () => {
      const url = 'postgresql://user:Secret123@127.0.0.1:5433/educare_db';

      // Contradiction 1: APP_ENV=production with unoptimized development runtime
      expect(() =>
        assertValidTargetForEnvironment(url, { nodeEnv: 'development', appEnv: 'production' }),
      ).toThrow('APP_ENV=production cannot run with unoptimized NODE_ENV=development runtime');

      // Contradiction 2: APP_ENV=production while staging flag is declared
      process.env.DEPLOYED_STAGING = 'true';
      expect(() =>
        assertValidTargetForEnvironment(url, { nodeEnv: 'production', appEnv: 'production' }),
      ).toThrow('APP_ENV indicates production tier while staging mode is declared');
      delete process.env.DEPLOYED_STAGING;
    });

    it('should decode URL-encoded hostnames and database names and enforce safety', () => {
      // URL-encoded production IP %31%34%38%2E%31%33%35%2E%31%33%38%2E%31%39%36 -> 148.135.138.196
      const encodedProdUrl = 'postgresql://user:Secret123@%31%34%38%2E%31%33%35%2E%31%33%38%2E%31%39%36:5432/postgres';
      expect(() =>
        assertValidTargetForEnvironment(encodedProdUrl, { appEnv: 'staging' }),
      ).toThrow(/identified as a production system/);

      // Double URL-encoded production IP %2531%2534%2538...
      const doubleEncodedProdUrl = 'postgresql://user:Secret123@%2531%2534%2538%252e%2531%2533%2535%252e%2531%2533%2538%252e%2531%2539%2536:5432/postgres';
      expect(() =>
        assertValidTargetForEnvironment(doubleEncodedProdUrl, { appEnv: 'staging' }),
      ).toThrow(/identified as a production system/);

      // Trailing dot in hostname (e.g. FQDN root)
      const trailingDotProdUrl = 'postgresql://user:Secret123@148.135.138.196.:5432/postgres';
      expect(() =>
        assertValidTargetForEnvironment(trailingDotProdUrl, { appEnv: 'staging' }),
      ).toThrow(/identified as a production system/);

      // URL-encoded database name
      const encodedDbUrl =
        'postgresql://user:Secret123@staging-db.educarelearning.in:5432/educare%5Fstaging?sslmode=require';
      const result = assertValidTargetForEnvironment(encodedDbUrl, { appEnv: 'staging' });
      expect(result.database).toBe('educare_staging');
    });

    it('should reject conflicting DIRECT_URL pointing to production when running in staging mode', () => {
      const validStagingUrl = 'postgresql://user:pass@staging-db.educarelearning.in:5432/educare_staging?sslmode=require';
      process.env.DIRECT_URL = 'postgresql://user:pass@148.135.138.196:5432/educare_prod?sslmode=require';

      expect(() =>
        assertValidTargetForEnvironment(validStagingUrl, { appEnv: 'staging' }),
      ).toThrow(/DIRECT_URL .* is pointing to a production system while running in staging mode/);

      delete process.env.DIRECT_URL;
    });

    it('should detect and reject DNS alias/CNAME spoofing resolving to production IP via verifyHostDnsSafety', async () => {
      // Mock DNS resolution returning production IP 148.135.138.196 for a benign-looking host
      const mockDnsLookup = jest.fn().mockResolvedValue([
        { address: '148.135.138.196', family: 4 },
      ]);

      await expect(
        verifyHostDnsSafety('innocent-staging-alias.internal', {
          dnsLookupFn: mockDnsLookup,
        }),
      ).rejects.toThrow(/DNS spoofing\/alias violation: Hostname "innocent-staging-alias.internal" resolves to production IP "148.135.138.196"/);

      // Mock DNS resolution returning safe staging IP
      const safeDnsLookup = jest.fn().mockResolvedValue([
        { address: '10.0.50.15', family: 4 },
      ]);

      await expect(
        verifyHostDnsSafety('verified-staging-host.internal', {
          dnsLookupFn: safeDnsLookup,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('3. Reconciliation Safe Target Enforcement', () => {
    it('should default to dryRun=true when --apply is omitted', () => {
      const url = 'postgresql://educare:pass@127.0.0.1:5433/educare_db';
      const { dryRun } = assertSafeReconciliationTarget(url, []);
      expect(dryRun).toBe(true);
    });

    it('should UNCONDITIONALLY REJECT reconciliation apply on production targets, even with extra env vars', () => {
      const prodUrl = 'postgresql://educare:Secret123@148.135.138.196:5432/postgres';
      process.env.ALLOW_PRODUCTION_RECONCILIATION = 'true';
      process.env.FORCE_APPLY = 'true';

      expect(() =>
        assertSafeReconciliationTarget(prodUrl, ['--apply', '--confirm-staging-target=postgres']),
      ).toThrow(/Automatic reconciliation script mutations are strictly prohibited on production databases/);
    });

    it('should REJECT apply mode if target is not an approved staging database', () => {
      const unapprovedUrl = 'postgresql://user:pass@198.51.100.10:5432/other_db?sslmode=require';
      expect(() =>
        assertSafeReconciliationTarget(unapprovedUrl, ['--apply', '--confirm-staging-target=other_db']),
      ).toThrow(/not an approved staging database/);
    });

    it('should REJECT apply mode if --confirm-staging-target is missing', () => {
      const stagingUrl = 'postgresql://educare:pass@127.0.0.1:5433/educare_db';
      expect(() =>
        assertSafeReconciliationTarget(stagingUrl, ['--apply']),
      ).toThrow(/requires explicit target confirmation via CLI argument --confirm-staging-target=educare_db/);
    });

    it('should REJECT apply mode if --confirm-staging-target does not match the actual database', () => {
      const stagingUrl = 'postgresql://educare:pass@127.0.0.1:5433/educare_db';
      expect(() =>
        assertSafeReconciliationTarget(stagingUrl, ['--apply', '--confirm-staging-target=wrong_db']),
      ).toThrow(/requires explicit target confirmation via CLI argument --confirm-staging-target=educare_db/);
    });

    it('should ALLOW apply mode on verified staging database with matching confirmation', () => {
      const stagingUrl = 'postgresql://educare:pass@127.0.0.1:5433/educare_staging';
      const { dryRun, targetInfo } = assertSafeReconciliationTarget(stagingUrl, [
        '--apply',
        '--confirm-staging-target=educare_staging',
      ]);
      expect(dryRun).toBe(false);
      expect(targetInfo.database).toBe('educare_staging');
      expect(targetInfo.isApprovedStagingTarget).toBe(true);
    });
  });

  describe('4. Zero-Leak Credential Verification in Errors', () => {
    it('should never include passwords or tokens in thrown error messages', () => {
      const password = 'SuperSecretUnrevealedPassword987!';
      const sensitiveUrl = `postgresql://user:${password}@148.135.138.196:5432/postgres`;

      try {
        assertValidTargetForEnvironment(sensitiveUrl, { nodeEnv: 'staging' });
        fail('Expected error to be thrown');
      } catch (err: any) {
        expect(err.message).not.toContain(password);
        expect(err.message).not.toContain('user:');
      }

      try {
        assertSafeReconciliationTarget(sensitiveUrl, ['--apply', '--confirm-staging-target=postgres']);
        fail('Expected error to be thrown');
      } catch (err: any) {
        expect(err.message).not.toContain(password);
        expect(err.message).not.toContain('user:');
      }
    });
  });
});
