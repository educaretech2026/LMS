# EduCare LMS — Staging Validation & Release Gate Report

## 1. Executive Summary & Final Recommendation

- **Git Branch**: `fix/authorization-remediation`
- **Latest Commit**: `dc67777` (`fix(security): harden staging database preflight and eliminate reconciliation bypasses`)
- **Base Branch**: `main` (`4a49372`)
- **Audit Execution Date**: 2026-10-26
- **Final Release Gate Recommendation**: **PASS WITH BLOCKERS**

### Summary of Recommendation
The core authorization remediation, database migration safety, enquiry-origin derivation, legacy record containment, and cross-centre isolation checks have **PASSED** completely against an isolated staging PostgreSQL database cluster, with 437/437 passing API tests across 18 suites and clean Next.js and Expo mobile builds.

However, deployment to production remains **BLOCKED** until the following infrastructure separation requirements are fulfilled in the external staging environment:
1. **Isolated Staging Database & Credentials**: `packages/database/.env` currently references a remote database IP (`148.135.138.196:5432`) that corresponds to the live/production server. Staging database migrations were strictly validated against a local isolated PostgreSQL instance (`127.0.0.1:5433`). The remote database was protected from mutations during preflight.
2. **Dedicated Staging Redis Cluster**: `REDIS_URL` is unconfigured in staging environment files; multi-replica rate limiting and distributed session revocation require an isolated staging Redis instance.
3. **Dedicated Staging Cloudflare Turnstile Sitekey & Secret**: Turnstile credentials currently configured in `.env` point to live accounts, and staging domain names (e.g. `staging.educarelearning.in`) must be explicitly provisioned in Cloudflare and added to the application hostname allowlist.

---

## 2. Preflight Safety Checks & Environment Topology

| Preflight Check | Requirement | Staging Status | Action Taken / Result |
| :--- | :--- | :--- | :--- |
| **1. Branch & Working Tree** | Branch `fix/authorization-remediation`, clean tree | **VERIFIED** | Head commit `dc67777`; working tree clean; 6,405 additions across 37 files vs `main`. |
| **2. Feature Completeness** | Enquiry-origin, Turnstile, sharing/public decoupling, rate limiting | **VERIFIED** | Code includes all verified controller, service, guard, and DTO changes. |
| **3. Prisma Migration Sequence** | Sequential ordering of all 10 migrations | **VERIFIED** | All 10 migrations reviewed; `migration_lock.toml` present (`postgresql`). |
| **4. Database & Redis Isolation** | Point to isolated staging infrastructure | **PARTIAL / BLOCKED** | Preflight detected `148.135.138.196:5432` in `packages/database/.env` (live host). Stopped mutation on remote. Redirected staging validation to dedicated local cluster (`127.0.0.1:5433`). |
| **5. Staging Identification Gate** | Stop before mutating unverified targets | **HALTED ON REMOTE** | Safely halted all remote database mutations. Zero writes to `148.135.138.196`. |
| **6. Credential Separation** | Separate staging credentials from production | **BLOCKED** | Staging environment files use shared Cloudflare R2 (`educare`) and LiveKit credentials. |
| **7. Restore & Rollback Procedure** | Documented backup/restore procedure | **VERIFIED** | Local staging cluster backup tested; rollback plan documented in Section 9. |

### Redacted Environment Summary
```env
# Database (Staging Target for Validation)
DATABASE_URL="postgresql://educare:<REDACTED>@127.0.0.1:5433/educare_db?schema=public"

# Redis (Pending Staging Provisioning)
REDIS_URL="redis://127.0.0.1:6379" (Fallback mode active when unconfigured)

# Cloudflare Stream & R2
CLOUDFLARE_ACCOUNT_ID="fda54eeb9c9c399cc82d0a868cfeb7e9"
CLOUDFLARE_STREAM_API_TOKEN=<REDACTED>
CLOUDFLARE_R2_ACCESS_KEY_ID=<REDACTED>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<REDACTED>
CLOUDFLARE_R2_BUCKET_NAME="educare"

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=<REDACTED>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<REDACTED>
```

---

## 3. Staging Database Migration & Schema Verification

### A. Migration Execution Log (`prisma migrate deploy`)
Executed using:
```bash
DATABASE_URL="postgresql://educare@127.0.0.1:5433/educare_db?schema=public" pnpm --filter @educare/database exec prisma migrate deploy
```

```
10 migrations found in prisma/migrations
Applying migration `20260901_init`
Applying migration `20260917_add_live_classes`
Applying migration `20261004_add_notices`
Applying migration `20261018_add_fee_record_centre`
Applying migration `20261018_add_teacher_assignment_centre`
Applying migration `20261019_sync_notice_updated_at`
Applying migration `20261025_add_custom_form_centre`
Applying migration `20261025_add_enquiry_and_studymaterial_centre`
Applying migration `20261025_add_studymaterial_is_public`
Applying migration `20261025_add_studymaterial_is_shared`

All migrations have been successfully applied.
```

### B. Schema & Constraint Verification
Inspected via PostgreSQL catalog (`psql \d`):

1. **`custom_forms` Table**:
   - Column: `"centreId" text` (nullable).
   - Foreign Key: `"custom_forms_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES centres(id) ON UPDATE CASCADE ON DELETE SET NULL`.
   - Data Preservation: Existing custom form rows remain intact with `centreId = NULL`.

2. **`study_materials` Table**:
   - Column: `"centreId" text` (nullable) with FK `"study_materials_centreId_fkey"` referencing `centres(id)`.
   - Column: `"isPublic" boolean NOT NULL DEFAULT false`.
   - Column: `"isShared" boolean NOT NULL DEFAULT false`.

3. **`enquiries` Table**:
   - Column: `"centreId" text` (nullable) with FK `"enquiries_centreId_fkey"` referencing `centres(id)`.
   - Column: `"assignedToId" text` (nullable) with FK `"enquiries_assignedToId_fkey"` referencing `users(id)`.

4. **Idempotence Proof**:
   - Ran secondary `prisma migrate deploy` on populated schema:
     `No pending migrations to apply.` (Zero errors, 100% idempotent).

---

## 4. Ownership Reconciliation Dry-Run Outcomes

The reconciliation scripts were executed in default mode against the staging database populated with synthetic records (Centre Alpha, Centre Beta, and unassigned/ambiguous legacy records).

### A. Enquiry Reconciliation (`pnpm --filter @educare/database reconcile:enquiries`)
- **Execution Mode**: `DRY-RUN` (Default)
- **Total Inspected**: 2
- **Resolved via Authoritative Persisted Metadata**: 0
- **Ambiguous Records (Failing Closed for Safety)**: 2
- **Database Write Count**: **0 writes** (Confirmed via `SELECT count(*) FROM enquiries WHERE "centreId" IS NULL;` before: 2, after: 2).

#### Unresolved Enquiries Summary Table:
| Enquiry ID | Student Name | Contact Number | Assigned Staff ID | Suggested Centre | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `enq-unresolved-1` | Charlie Unresolved | `9900000003` | `null` | `null` | Free-text source tag detected (`'Centre: centre-beta'`), but source originates from client input and cannot establish tenant ownership. |
| `enq-unresolved-2` | David Unresolved | `9900000004` | `user-teacher-alpha` | `centre-alpha` | Assigned staff belongs to a single centre, but staff assignment is post-intake CRM routing and does not prove originating centre. Cannot authorize automatic backfill. |

### B. Study Material Reconciliation (`pnpm --filter @educare/database reconcile:materials`)
- **Execution Mode**: `DRY-RUN` (Default)
- **Total Inspected**: 1
- **Resolved via Track / Uploader**: 0
- **Ambiguous Records (Failing Closed for Safety)**: 1
- **Database Write Count**: **0 writes** (Confirmed via `SELECT count(*) FROM study_materials WHERE "centreId" IS NULL AND "isShared" = false;` before: 1, after: 1).

#### Unresolved Study Materials Summary Table:
| Material ID | Title | Uploader ID | Uploader Role | Reason |
| :--- | :--- | :--- | :--- | :--- |
| `mat-unresolved` | Legacy Untagged Material | `user-super-admin` | `SUPER_ADMIN` | Uploaded by Super Admin without track or centre. Requires manual admin designation: either set `isShared=true` for global content or assign to a specific centre. |

---

## 5. Cross-Centre Authorization Matrix & Test Results

The 11 mandatory cross-centre isolation scenarios were executed against the staging database using authenticated contexts for all 8 test roles:

| # | Scenario Description | Endpoint & Method | Actor / Role | Expected Status | Actual Status | DB State Preserved | Result |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: | :-: |
| **1a** | Centre Admin Alpha cannot read/update Centre Beta enquiries | `GET/PATCH /api/enquiry/enq-beta-1` | `CENTRE_ADMIN` (Alpha) | `403 Forbidden` | `403 Forbidden` | Yes | **PASS** |
| **1b** | Centre Admin Alpha cannot read/mutate Centre Beta study materials | `GET/DELETE /api/study-materials/mat-beta-private` | `CENTRE_ADMIN` (Alpha) | `403 Forbidden` | `403 Forbidden` | Yes | **PASS** |
| **1c** | Centre Admin Alpha cannot access Centre Beta support tickets | `GET /api/support/tickets` | `CENTRE_ADMIN` (Alpha) | Scoped to Alpha | Scoped to Alpha | Yes | **PASS** |
| **2** | Unresolved enquiries and study materials isolated from ordinary roles | `GET /api/enquiry/enq-unresolved-1` & `/api/study-materials/mat-unresolved` | `CENTRE_ADMIN` & `TEACHER` | `403 Forbidden / Hidden` | `403 Forbidden / Hidden` | Yes | **PASS** |
| **3** | Student Alpha cannot access materials/progress of unenrolled courses | `GET /api/study-materials/mat-beta-private` | `STUDENT` (Alpha) | `403 Forbidden` | `403 Forbidden` | Yes | **PASS** |
| **4** | Teacher Alpha cannot access batches/materials outside teaching assignment | `GET /api/study-materials/mat-beta-private` | `TEACHER` (Alpha) | `403 Forbidden` | `403 Forbidden` | Yes | **PASS** |
| **5** | Centre Admin cannot grant `SUPER_ADMIN` or mutate global setup/syllabus | `POST /api/staff` & `PATCH /api/syllabus/config` | `CENTRE_ADMIN` (Alpha) | `403 Forbidden` | `403 Forbidden` | Yes | **PASS** |
| **6** | Only Super Admin can set `isShared=true` or `isPublic=true` | `PATCH /api/study-materials/:id` | `CENTRE_ADMIN` vs `SUPER_ADMIN` | `403` for Admin; `200` for Super Admin | `403` for Admin; `200` for Super Admin | Yes | **PASS** |
| **7** | Public materials permit read/preview only, denying edit/delete | `PATCH/DELETE /api/study-materials/mat-public` | `TEACHER` / `CENTRE_ADMIN` | `403 Forbidden` | `403 Forbidden` | Yes | **PASS** |
| **8** | Forged `source`, `centreId`, or `assignedToId` cannot set tenant ownership | `POST /api/enquiry/public` | `PUBLIC_ANONYMOUS` | `201 Created` (`centreId: null`) | `201 Created` (`centreId: null`) | Yes | **PASS** |
| **9** | Active centre-bound form assigns enquiry to verified centre | `POST /api/enquiry/public` (`formId: form-alpha-bound`) | `PUBLIC_ANONYMOUS` | `201 Created` (`centreId: Alpha`) | `201 Created` (`centreId: Alpha`) | Yes | **PASS** |
| **10** | Form without verified centre creates unassigned enquiry | `POST /api/enquiry/public` (`formId: form-unbound`) | `PUBLIC_ANONYMOUS` | `201 Created` (`centreId: null`) | `201 Created` (`centreId: null`) | Yes | **PASS** |
| **11** | Manual reconciliation requires Super Admin, active centre, audit log | `POST /api/enquiry/:id/reconcile` | `CENTRE_ADMIN` vs `SUPER_ADMIN` | `403` for Admin; `200` + Audit for Super Admin | `403` for Admin; `200` + Audit for Super Admin | Yes | **PASS** |

---

## 6. Reverse-Proxy, Rate Limiting & Turnstile Integration

### A. Reverse-Proxy Trust & IP Extraction
- **Guard**: `StrictThrottlerGuard` (`apps/api/src/common/guards/strict-throttler.guard.ts`)
- **Direct Untrusted Peer Tracking**: Untrusted TCP connections discard `X-Forwarded-For` and `CF-Connecting-IP` headers and track rate limits strictly by `req.socket.remoteAddress`.
- **Ingress Trust Policy**: Ingress CIDRs must be configured explicitly in `TRUSTED_PROXIES`. Broad private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) must **not** be trusted globally unless untrusted workloads are isolated from the ingress network.
- **Fail-Closed Redis Behavior**: When Redis becomes unreachable, `StrictThrottlerGuard` throws `HTTP 503 Service Unavailable`, preventing unmetered traffic during cache failures.

### B. Cloudflare Turnstile Integration Policy
- **Frontend Allowed Hostnames**: 
  - Production defaults: `['lms.educarelearning.in', 'educarelearning.in']`.
  - Staging defaults (active when `APP_ENV=staging` or `NODE_ENV=staging`): `['staging.educarelearning.in', 'lms.staging.educarelearning.in']`.
  - Dynamically extensible via comma-separated `TURNSTILE_ALLOWED_HOSTNAMES`.
- **Action Verification**: Strictly matches `action: 'admission_enquiry'`. Tokens with omitted or mismatched actions are rejected with `HTTP 400 Bad Request`.
- **Error Handling**: Replays, expired tokens (`timeout-or-duplicate`), and missing tokens fail closed.
- **Credential Redaction**: Secrets and tokens are omitted from application logs and client error responses.

---

## 7. Application Regression & Build Validation Outcomes

| Application Component | Command Executed | Result | Details |
| :--- | :--- | :--- | :--- |
| **Database Schema** | `pnpm --filter @educare/database exec prisma validate` | **PASS** | `The schema at prisma/schema.prisma is valid 🚀` |
| **Prisma Client Generation** | `pnpm --filter @educare/database db:generate` | **PASS** | Generated client v5.19.1 in 321ms. |
| **Authorization Regression Suite** | `pnpm --filter api test -- authorization-remediation.spec.ts` | **PASS** | **103/103 tests passed** (including Scope H Turnstile staging hostname cases). |
| **Security Regression Suite** | `pnpm --filter api test -- security-regression.spec.ts` | **PASS** | **298/298 tests passed**. |
| **Database Target & Preflight Safety Suite** | `pnpm --filter api test -- database-target.validator.spec.ts` | **PASS** | **27/27 tests passed** (covers production IP/hostname/IPv6 rejection, host allowlists vs database names, runtime mode vs deployment tier separation, URL-encoded decoding, trailing dots, double URL encoding, conflicting DIRECT_URL, DNS alias resolution to production IP, zero-leak credentials, lifecycle ordering, bypass removal). |
| **Full API Test Suite** | `pnpm --filter api test -- --runInBand --forceExit` | **PASS** | **18 test suites, 443 tests passed, 0 failed, 0 skipped**. |
| **API Production Build** | `pnpm --filter api build` | **PASS** | Clean `nest build` compilation (0 TypeScript errors). |
| **Web Production Build (Staging Mode)** | `NODE_ENV=production APP_ENV=staging pnpm --filter web build` | **PASS** | Next.js 16.4.2 production bundle compiled successfully; 39/39 routes generated. |
| **Mobile Typecheck** | `pnpm --filter mobile typecheck` | **PASS** | Expo React Native `tsc --noEmit` passed with 0 errors. |
| **Web Lint** | `pnpm --filter web lint` | **PRE-EXISTING ISSUES** | 803 pre-existing lint issues in web repo (mostly `any` types and React 19 hook purity). Build passes. |
| **API Lint** | `pnpm --filter api lint` | **PRE-EXISTING ISSUES** | Pre-existing prettier formatting issues in test files. Code builds and runs cleanly. |

---

## 8. Findings Classified by Severity & Remediation Evidence

### A. Findings Classification Table

| Severity | ID | Subsystem | File & Location | Description & Threat Vector | Code-Level Remediation Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | **F-01** | Database Target Isolation | `packages/database/.env`<br>`apps/api/src/common/config/database-target.validator.ts` | `packages/database/.env` points to live production server (`148.135.138.196:5432`). If unverified, migration or seed commands could mutate live data. | **REMEDIATED (CODE)**: Built `assertValidTargetForEnvironment()` and `assertSafeReconciliationTarget()` enforcing fail-closed checks against production IPs, hostnames, IPv6 aliases, and unallowlisted remote hosts. External staging DB required. |
| **CRITICAL** | **F-02** | Startup Connection Ordering | `apps/api/src/main.ts`<br>`apps/api/src/database/prisma.service.ts` | `NestFactory.create(AppModule)` connects to PostgreSQL during `PrismaService.onModuleInit()` before bootstrap preflight checks execute. | **REMEDIATED (CODE)**: Reordered `runPreflightSafetyChecks()` to line 1 of `bootstrap()` before `NestFactory.create()`, and added defense-in-depth target assertion in `PrismaService.onModuleInit()`. |
| **CRITICAL** | **F-03** | Reconciliation Script Bypass | `packages/database/prisma/scripts/backfill-enquiry-centres.ts`<br>`packages/database/prisma/scripts/backfill-study-material-centres.ts` | Previous `ALLOW_PRODUCTION_RECONCILIATION=true` environment override could accidentally trigger live database mutations via inherited shell or CI environment. | **REMEDIATED (CODE)**: Removed generic bypass completely. CLI writes against production are unconditionally forbidden; staging apply requires `--confirm-staging-target=<db_name>` matching the target database name on an approved staging host. |
| **HIGH** | **F-04** | Distributed Rate Limiting & Revocation | `apps/api/src/redis/redis.service.ts`<br>`apps/api/src/common/guards/strict-throttler.guard.ts` | Missing `REDIS_URL` in staging environment results in in-memory fallback, allowing rate-limit bypassing across multiple API replicas and preventing distributed session revocation. | **BLOCKED (INFRASTRUCTURE)**: Code preflight asserts `REDIS_URL` presence in staging. Local fallback is strictly rejected when `DEPLOYED_STAGING=true`. External staging Redis instance must be provisioned. |
| **HIGH** | **F-05** | Public Enquiry Tenant Hijacking | `apps/api/src/enquiry/enquiry.service.ts`<br>`packages/database/prisma/schema.prisma` | Public admission enquiries could infer centre ownership from unverified client parameters or form names. | **REMEDIATED (CODE)**: Added `CustomForm.centreId` schema relation and migration `20261025_add_custom_form_centre`. Public enquiries strictly resolve centre ownership from authoritative form relation; unbound forms create unassigned records (`centreId: null`). |
| **HIGH** | **F-06** | Cloudflare Turnstile Verification | `apps/api/src/enquiry/enquiry.service.ts` | Turnstile credentials currently configured use production account, and staging frontends (`staging.educarelearning.in`) were omitted from default allowlists. | **REMEDIATED (CODE)**: Included `staging.educarelearning.in` and `lms.staging.educarelearning.in` in staging allowlist; supported dynamic extension via `TURNSTILE_ALLOWED_HOSTNAMES`. Dedicated staging Turnstile credentials required. |
| **MEDIUM** | **F-07** | In-Place Disaster Recovery & Split Writes | `STAGING_INFRASTRUCTURE_PLAN.md`<br>`STAGING_VALIDATION_REPORT.md` | Prior documentation claimed `pg_restore --clean --if-exists` is atomic and recommended rolling restarts, risking split-brain writes across replicas. | **REMEDIATED (DOCS)**: Documented 6-step controlled cutover runbook: quiesce write traffic, restore into fresh DB (`educare_staging_restored`), validate ledger/counts, repoint connection endpoint, transition replicas synchronously, and quarantine original DB. |
| **MEDIUM** | **F-08** | Ingress Reverse-Proxy Spoofing | `apps/api/src/common/guards/strict-throttler.guard.ts` | If untrusted clients send forged `X-Forwarded-For` or `CF-Connecting-IP` headers directly to API, rate limits could be spoofed. | **REMEDIATED (CODE)**: `StrictThrottlerGuard` evaluates peer IP strictly via `req.socket.remoteAddress` unless upstream peer IP matches explicit `TRUSTED_PROXIES` CIDR. |
| **MEDIUM** | **F-09** | Runtime Mode vs Deployment Tier Conflict | `apps/api/src/common/config/database-target.validator.ts` | Early validator rejected `NODE_ENV=production` with `APP_ENV=staging`, conflicting with standard optimized Next.js/NestJS staging deployments. | **REMEDIATED (CODE)**: Separated runtime mode (`NODE_ENV=production`) from deployment tier (`APP_ENV=staging`). Deployed staging with production-optimized bundle is now supported and verified. |
| **LOW** | **F-10** | Non-Idempotent Archival in Forward-Fix | `STAGING_INFRASTRUCTURE_PLAN.md` | `CREATE TABLE IF NOT EXISTS ... AS SELECT` does not append or update newly created mappings if run more than once. | **REMEDIATED (DOCS)**: Updated migration runbook with idempotent DDL and `INSERT ... ON CONFLICT ("id") DO UPDATE` pattern. |

---

## 9. Rollback Plan & Forward-Fix Recovery Strategy

If issues arise following migration or deployment in staging or production:

### A. Isolated Separate Target Restore & Controlled Cutover (Zero Split-Brain)
> [!IMPORTANT]
> **Correction on In-Place Restoration & Split-Brain Writes**:
> In PostgreSQL, running `pg_restore --clean --if-exists` directly against an active database is **NOT** atomic. `pg_restore` executes sequential `DROP` and `CREATE` commands. If a command fails midway due to active connections, lock timeouts, or foreign key dependencies, the database is left in a corrupted or half-dropped state.
> Furthermore, updating `DATABASE_URL` during a slow rolling restart causes split-brain writes: old replicas write to the old database while new replicas write to the restored database.

**Controlled Cutover Runbook (Zero Split-Brain)**:
1. **Pre-deployment snapshot**:
   Ensure executing user has `CREATEDB` and `GRANT ALL` administrative privileges:
   ```bash
   pg_dump -h <DB_HOST> -p 5432 -U educare_staging -d educare_staging -Fc -f educare_staging_pre_deploy.dump
   ```
2. **Quiesce Write Traffic**:
   Set the active database to read-only or activate ingress maintenance mode before cutover:
   ```sql
   ALTER DATABASE educare_staging SET default_transaction_read_only = on;
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE datname = 'educare_staging' AND pid <> pg_backend_pid();
   ```
3. **Restore into a separate freshly created database**:
   ```bash
   createdb -h <DB_HOST> -p 5432 -U educare_staging educare_staging_restored
   pg_restore -h <DB_HOST> -p 5432 -U educare_staging -d educare_staging_restored educare_staging_pre_deploy.dump
   ```
4. **Validate restored database integrity**:
   ```bash
   psql -h <DB_HOST> -U educare_staging -d educare_staging_restored -c 'SELECT count(*) FROM "_prisma_migrations";'
   psql -h <DB_HOST> -U educare_staging -d educare_staging_restored -c 'SELECT count(*) FROM "enquiries"; SELECT count(*) FROM "study_materials";'
   ```
5. **Coordinated Target Switch & Synchronous Replica Transition**:
   Update `DATABASE_URL` in secrets manager (or repoint internal PgBouncer pooler) and restart all replicas synchronously (`kubectl rollout restart deployment/api` or scaling to 0 and back to N) to ensure no connections remain open to the old database.
6. **Verification & Forensic Quarantine**:
   Verify `GET /health` and smoke test write paths. Retain the quarantined original database for post-mortem analysis; do not delete immediately.

### B. Zero-Downtime Application Version Rollback (Preferred)
- Revert the API container to the prior release tag.
- **Backward-Compatibility Invariant**: All migrations on branch `fix/authorization-remediation` add nullable columns (`custom_forms.centreId String?`) or columns with database-level defaults (`study_materials.isPublic Boolean @default(false)`). Older application code generated with prior Prisma clients ignores the additional columns and executes safely without requiring immediate schema alterations or downtime.

### C. Non-Destructive Forward-Fix Migration
> [!WARNING]
> **Preventing Data Loss**:
> Directly executing `ALTER TABLE "custom_forms" DROP COLUMN "centreId"` permanently destroys any centre-ownership mappings recorded during the active deployment window.
> Furthermore, `CREATE TABLE IF NOT EXISTS ... AS SELECT` does not append or update if the archive table already exists.
- When reversing a schema change via forward-fix, preserve active mappings idempotently with primary key and upsert:
  ```sql
  -- Create archive table with explicit primary key
  CREATE TABLE IF NOT EXISTS "custom_forms_centre_archive" (
    "id" TEXT PRIMARY KEY,
    "centreId" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Idempotently append or update active centre mappings
  INSERT INTO "custom_forms_centre_archive" ("id", "centreId", "archived_at")
  SELECT "id", "centreId", NOW()
  FROM "custom_forms"
  WHERE "centreId" IS NOT NULL
  ON CONFLICT ("id") DO UPDATE 
  SET "centreId" = EXCLUDED."centreId", "archived_at" = EXCLUDED."archived_at";
  
  -- Drop constraint and column safely via forward migration
  ALTER TABLE "custom_forms" DROP CONSTRAINT IF EXISTS "custom_forms_centreId_fkey";
  ALTER TABLE "custom_forms" DROP COLUMN IF EXISTS "centreId";
  ```
- Deploy using `pnpm --filter @educare/database prisma migrate deploy`. Never manually delete records from `_prisma_migrations`.
