# EduCare LMS — Staging Validation & Release Gate Report

## 1. Executive Summary & Final Recommendation

- **Git Branch**: `fix/authorization-remediation`
- **Latest Commit**: `9c316b0` (`fix(security): add idempotent custom_forms centreId migration and document disposable db verification`)
- **Base Branch**: `main`
- **Audit Execution Date**: 2026-10-26
- **Final Release Gate Recommendation**: **PASS WITH BLOCKERS**

### Summary of Recommendation
The core authorization remediation, database migration safety, enquiry-origin derivation, legacy record containment, and cross-centre isolation checks have **PASSED** completely against an isolated staging PostgreSQL database cluster, with 434/434 passing API tests across 18 suites and clean Next.js and Expo mobile builds.

However, deployment to production remains **BLOCKED** until the following infrastructure separation requirements are fulfilled in the external staging environment:
1. **Isolated Staging Database & Credentials**: `packages/database/.env` currently references a remote database IP (`148.135.138.196:5432`) that corresponds to the live/production server. Staging database migrations were strictly validated against a local isolated PostgreSQL instance (`127.0.0.1:5433`). The remote database was protected from mutations during preflight.
2. **Dedicated Staging Redis Cluster**: `REDIS_URL` is unconfigured in staging environment files; multi-replica rate limiting and distributed session revocation require an isolated staging Redis instance.
3. **Dedicated Staging Cloudflare Turnstile Sitekey & Secret**: Turnstile credentials currently configured in `.env` point to live accounts, and staging domain names (e.g. `staging.educarelearning.in`) must be explicitly provisioned in Cloudflare and added to the application hostname allowlist.

---

## 2. Preflight Safety Checks & Environment Topology

| Preflight Check | Requirement | Staging Status | Action Taken / Result |
| :--- | :--- | :--- | :--- |
| **1. Branch & Working Tree** | Branch `fix/authorization-remediation`, clean tree | **VERIFIED** | Head commit `9c316b0`; working tree clean; 5,058 additions across 32 files vs `main`. |
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
- **Frontend Allowed Hostnames**: `defaultHostnames = ['lms.educarelearning.in', 'educarelearning.in']`.
- **Action Verification**: Strictly matches `action: 'admission_enquiry'`. Tokens with omitted or mismatched actions are rejected with `HTTP 400 Bad Request`.
- **Error Handling**: Replays, expired tokens (`timeout-or-duplicate`), and missing tokens fail closed.
- **Credential Redaction**: Secrets and tokens are omitted from application logs and client error responses.

---

## 7. Application Regression & Build Validation Outcomes

| Application Component | Command Executed | Result | Details |
| :--- | :--- | :--- | :--- |
| **Database Schema** | `pnpm --filter @educare/database exec prisma validate` | **PASS** | `The schema at prisma/schema.prisma is valid 🚀` |
| **Prisma Client Generation** | `pnpm --filter @educare/database db:generate` | **PASS** | Generated client v5.19.1 in 321ms. |
| **Authorization Regression Suite** | `pnpm --filter api test -- authorization-remediation.spec.ts` | **PASS** | **101/101 tests passed** (including Scope J cases 1–10). |
| **Security Regression Suite** | `pnpm --filter api test -- security-regression.spec.ts` | **PASS** | **298/298 tests passed**. |
| **Database Target & Preflight Safety Suite** | `pnpm --filter api test -- database-target.validator.spec.ts` | **PASS** | **20/20 tests passed** (covers production IP/hostname rejection, allowlists, zero-leak credentials, lifecycle ordering, bypass removal). |
| **Full API Test Suite** | `pnpm --filter api test -- --runInBand --forceExit` | **PASS** | **18 test suites, 434 tests passed, 0 failed, 0 skipped**. |
| **API Production Build** | `pnpm --filter api build` | **PASS** | Clean `nest build` compilation (0 TypeScript errors). |
| **Web Production Build** | `pnpm --filter web build` | **PASS** | Next.js 16.4.2 production bundle compiled successfully; 39/39 routes generated. |
| **Mobile Typecheck** | `pnpm --filter mobile typecheck` | **PASS** | Expo React Native `tsc --noEmit` passed with 0 errors. |
| **Web Lint** | `pnpm --filter web lint` | **PRE-EXISTING ISSUES** | 803 pre-existing lint issues in web repo (mostly `any` types and React 19 hook purity). Build passes. |
| **API Lint** | `pnpm --filter api lint` | **PRE-EXISTING ISSUES** | Pre-existing prettier formatting issues in test files. Code builds and runs cleanly. |

---

## 8. Issues Found, Implemented Hardening & Required External Fixes

### A. Implemented Safety Hardening (Code Level)
1. **Fail-Closed Target Verification (`database-target.validator.ts`)**:
   - Implemented RFC URL parsing that strips credentials before logging (zero log leakage).
   - Rejects production IPs (`148.135.138.196`) and hostnames (`api.educarelearning.in`, `db.educarelearning.in`, `educarelearning.in`) unconditionally in non-production environments.
   - Requires explicit allowlisting (`STAGING_DATABASE_HOST` or `STAGING_DATABASE_ALLOWLIST`) and TLS (`sslmode=require`) for remote staging targets.
   - Detects conflicting/ambiguous environment identities (e.g. `NODE_ENV=production` while `APP_ENV=staging`).
2. **NestJS Pre-Instantiation Startup Ordering**:
   - Reordered `bootstrap()` in `apps/api/src/main.ts` so `runPreflightSafetyChecks()` executes **prior** to `NestFactory.create(AppModule)`, preventing `PrismaService.onModuleInit()` from connecting to an unverified target.
   - Added secondary defense-in-depth target validation in `PrismaService.onModuleInit()` before `this.$connect()`.
3. **Reconciliation Script Safeguards**:
   - Removed generic `ALLOW_PRODUCTION_RECONCILIATION=true` environment override.
   - Unconditionally blocks mutations against production targets.
   - Requires explicit `--apply` AND `--confirm-staging-target=<db_name>` flag matching the target database name.

### B. Remaining External Infrastructure Requirements (Blockers)
1. **Remote Target Separation (CRITICAL)**:
   - Deploy an isolated staging database instance (e.g. `staging-db.educare.internal` or managed RDS/Cloud SQL) and populate `STAGING_DATABASE_ALLOWLIST`. Do not run migrations against `148.135.138.196`.
2. **Missing Staging Redis Configuration**:
   - Provision an isolated, authenticated Redis 7 instance and configure `REDIS_URL`.
3. **Turnstile Staging Hostname Configuration**:
   - Configure a dedicated staging Turnstile sitekey and secret in Cloudflare for `staging.educarelearning.in` and add it to `allowedHostnames`.

---

## 9. Rollback Plan & Forward-Fix Recovery Strategy

If issues arise following migration or deployment in staging or production:

1. **Atomic Snapshot Restore (Disaster Recovery)**:
   - Prior to running `prisma migrate deploy`, take a consistent full snapshot:
     ```bash
     pg_dump -h <DB_HOST> -p 5432 -U educare -d educare_db -Fc -f educare_db_pre_remediation.dump
     ```
   - If immediate rollback is necessary before operational transactions occur, restore atomically to restore schema and migration ledger consistency:
     ```bash
     pg_restore -h <DB_HOST> -p 5432 -U educare -d educare_db --clean --if-exists educare_db_pre_remediation.dump
     ```

2. **Forward-Fix Migration Strategy (Preserving Migration History)**:
   - **Prohibition on Destructive History Edits**: Manual deletion of rows from `_prisma_migrations` (`DELETE FROM "_prisma_migrations"`) is strictly prohibited in production and staging environments. Deleting migration records causes checksum drift, desynchronizes deployment pipelines, and breaks future `prisma migrate deploy` invocations.
   - **Forward-Fix Procedure**: If a schema change must be reversed post-deployment, create and apply a forward-fix migration (e.g. `20261026_revert_custom_form_centre/migration.sql`):
     ```sql
     -- Revert constraint and column via forward migration
     ALTER TABLE "custom_forms" DROP CONSTRAINT IF EXISTS "custom_forms_centreId_fkey";
     ALTER TABLE "custom_forms" DROP COLUMN IF EXISTS "centreId";
     ```
   - Apply the forward-fix via `prisma migrate deploy`. This preserves an immutable, auditable migration history across all environments.

3. **Application Version Rollback**:
   - Revert the API container/process to the prior commit preceding `fix/authorization-remediation`.
   - Because all schema changes in this remediation are strictly additive and non-breaking (all new columns are nullable or have safe defaults like `false`), the prior application version remains fully operational against the updated schema.
