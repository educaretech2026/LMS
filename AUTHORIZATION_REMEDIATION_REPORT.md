# EduCare LMS — Comprehensive Authorization Remediation & Post-Review Report

## 1. Executive Summary

This report documents the security fixes, multi-tenant authorization remediations, and post-remediation security gap closures implemented in the `educare_lms` repository.

Following the initial audit, a rigorous post-remediation review was conducted across all tenant-isolation boundaries, legacy record behaviors, public intake endpoints, and configuration mutation routes:

1. **Fail-Closed Handling of Legacy Study Materials (Priority 1)**:
   - Eradicated the vulnerability where legacy study materials with `centreId = null` were inferred to be globally shared based on uploader role (`SUPER_ADMIN`) or null target track.
   - Added an explicit `isShared Boolean @default(false)` field to the `StudyMaterial` schema and generated a backward-compatible PostgreSQL migration with `CURRENT_SCHEMA` idempotency.
   - Enforced fail-closed access: materials missing `centreId` that are not explicitly flagged `isShared = true` are strictly inaccessible to ordinary students, teachers, and centre admins (unless the caller is the verified uploader).
   - Provided dedicated Super Admin reconciliation capabilities via `GET /api/study-materials/unreconciled`.
   - Ensured private video playback URLs (`GET /api/study-materials/:id/play-url`) enforce identical authorization decisions.

2. **Public Enquiry Abuse Protection & Anti-Automation (Priority 2)**:
   - Implemented `StrictThrottlerGuard` overriding tracker derivation to bind strictly to socket remote addresses (`req.socket.remoteAddress`), preventing rate limit bypass via forged `X-Forwarded-For` headers.
   - Applied rate limiting (`@Throttle({ default: { limit: 5, ttl: 60000 } })`) returning HTTP 429 Too Many Requests without modifying the database.
   - Preserved strict contact-field whitelisting and added format validation for phone numbers and emails; client-supplied `status`, `assignedToId`, internal notes, and unverified centre IDs are discarded.
   - Added native Cloudflare Turnstile verification support when `TURNSTILE_SECRET_KEY` is configured.

3. **Complete Configuration Authorization Enforcement (Priority 3)**:
   - Bound `/setup/settings` and `/syllabus-config` mutations strictly to `SUPER_ADMIN` with `RolesGuard`.
   - Enforced strict whitelist sanitization: extra unauthorized fields submitted in request payloads are stripped and cannot be persisted; invalid payloads are rejected with `400 Bad Request`.
   - Unauthenticated and unauthorized callers are rejected, leaving the database state completely unchanged.

4. **Migration & Ownership Reconciliation Review (Priority 4)**:
   - Audited PostgreSQL DDL migrations: verified foreign key actions (`ON DELETE SET NULL`), column names, and scoped all `information_schema` idempotency queries to `table_schema = CURRENT_SCHEMA`.
   - Implemented two safe, dry-run reconciliation CLI scripts: `backfill-enquiry-centres.ts` and `backfill-study-material-centres.ts` that only resolve unambiguous records and fail closed on ambiguous records.

5. **Public Route Access Fix for Webinars & Live Classes**:
   - Fixed `PermissionsGuard` and `RolesGuard` to check `IS_PUBLIC_KEY` before checking user authentication, resolving the HTTP `403 Forbidden` error on public webinar URLs (`/api/live-class/public/:id`).

All changes strictly follow fail-closed access control principles.

---

## 2. Branch Name and Working-Tree Status

- **Git Branch**: `fix/authorization-remediation`
- **Base Branch**: `main`
- **Commit Author**: `nonstradamoz <nonstradamoz@users.noreply.github.com>`
- **Working-Tree Status**: Validated with complete compilation and test passes.

---

## 3. Files Changed and Rationale

| File Path | Component | Rationale & Change Summary |
| :--- | :--- | :--- |
| `packages/database/prisma/schema.prisma` | Database Schema | Added `centreId String?` and `Centre?` relations to `Enquiry` and `StudyMaterial`. Added `isShared Boolean @default(false)` to `StudyMaterial` for explicit global content designation. |
| `packages/database/prisma/migrations/20261025_add_enquiry_and_studymaterial_centre/migration.sql` | Migration SQL | Scoped idempotency queries to `table_schema = CURRENT_SCHEMA` and `constraint_schema = CURRENT_SCHEMA`. |
| `packages/database/prisma/migrations/20261025_add_studymaterial_is_shared/migration.sql` | Migration SQL | Created migration adding `"isShared" BOOLEAN NOT NULL DEFAULT false` to `study_materials` table with schema-scoped idempotency. |
| `packages/database/prisma/scripts/backfill-enquiry-centres.ts` | Reconciliation CLI | Dry-run and apply CLI script to reconcile unassigned enquiries based on single-centre staff relationships. Ambiguous records fail closed. |
| `packages/database/prisma/scripts/backfill-study-material-centres.ts` | Reconciliation CLI | Dry-run and apply CLI script to reconcile study materials based on target track batch centres and single-centre teacher uploaders. Ambiguous records fail closed. |
| `packages/database/package.json` | Package Manifest | Added npm scripts `reconcile:enquiries` and `reconcile:materials`. |
| `apps/api/src/common/guards/permissions.guard.ts` | Global Guard | Added `IS_PUBLIC_KEY` check at beginning of `canActivate` to allow public routes (e.g. `/live-class/public/:id`) without throwing 403 on missing user. |
| `apps/api/src/common/guards/roles.guard.ts` | Global Guard | Added `IS_PUBLIC_KEY` check to allow public routes immediately without role requirements. |
| `apps/api/src/common/guards/strict-throttler.guard.ts` | Rate Limit Guard | Created `StrictThrottlerGuard` inheriting `ThrottlerGuard`; extracts tracker from genuine socket connection address; returns clean 429 response without leaking personal data; includes optional constructor parameters for test isolation. |
| `apps/api/src/enquiry/enquiry.controller.ts` | Enquiry Controller | Applied `@UseGuards(StrictThrottlerGuard)` and `@Throttle({ default: { limit: 5, ttl: 60000 } })` to public intake route. |
| `apps/api/src/enquiry/enquiry.service.ts` | Enquiry Service | Whitelisted contact fields; added telephone digit and email format validation; stripped privileged fields (`status`, `assignedToId`, `notes`, `followUpDate`); added optional Cloudflare Turnstile token validation; implemented `getUnreconciledEnquiries()`. |
| `apps/api/src/study-materials/study-materials.controller.ts` | Study Material Controller | Added `@Get('unreconciled')` endpoint restricted to `SUPER_ADMIN`. |
| `apps/api/src/study-materials/study-materials.service.ts` | Study Material Service | Enforced that missing `centreId` never implies global sharing; required `isShared === true` for global content; denied ordinary users access to unresolved records unless self-uploaded; protected `isShared` from non-super-admin deletion; added `getUnreconciled()`. |
| `apps/api/src/setup/setup.controller.ts` | Setup Controller | Restricted `PUT /setup/settings` to `@Roles('SUPER_ADMIN')`. |
| `apps/api/src/setup/setup.service.ts` | Setup Service | Ensured `updateSettings` only modifies whitelisted fields (`name`, `email`, `contactNo`, `currentYear`). |
| `apps/api/src/syllabus/config.controller.ts` | Config Controller | Restricted `PUT /syllabus-config` to `@Roles('SUPER_ADMIN')` with field whitelisting rejecting empty/invalid updates. |
| `apps/api/src/common/authorization-remediation.spec.ts` | Test Suite | Comprehensive regression suite expanded to 50 tests covering Scopes A-C, public guard bypass, legacy study materials, rate limiting, and configuration authorization. |
| `apps/api/src/common/security-regression.spec.ts` | Test Suite | Updated `mat-superadmin-public` mock to reflect `isShared: true` for explicit global sharing test case. |

---

## 4. Authorization Policies & Invariants Enforced

### A. Study Materials & Video Playback (Priority 1)
- **Global Sharing Invariant**: A null `centreId` NEVER grants global access. Content is only globally accessible across centres if `isShared === true`.
- **Legacy Unresolved Records**: Records with `centreId = null` and `isShared = false` are classified as unresolved.
  - **Super Admins**: May view all records for audit and reconciliation.
  - **Uploaders**: Teachers and admins can view and delete records they directly uploaded (`uploaderId === user.id`).
  - **Ordinary Users**: Students, teachers, and centre admins cannot access unresolved records uploaded by third parties (`HTTP 403 Forbidden`).
- **Private Video Playback**: `GET /api/study-materials/:id/play-url` delegates to `getById`, enforcing the same access control before generating presigned Cloudflare R2 download URLs.
- **Mutation Invariant**: Non-super admins cannot set `isShared = true` on creation, and cannot delete explicitly shared materials (`HTTP 403 Forbidden`).

### B. Public Enquiry Intake & Rate Limiting (Priority 2)
- **Client IP Tracking**: Rate limit tracker derives from `req.socket.remoteAddress` (or normalized IP). Client-forged `X-Forwarded-For` headers cannot manipulate or evade rate limit buckets.
- **Throttling Threshold**: 5 requests per 60-second sliding window per client IP. Excess requests return `429 Too Many Requests` without executing any database query or persisting data.
- **Input Whitelist & Validation**:
  - Required: `studentName` (2-100 characters), `contactNumber` (7-20 telephone digits).
  - Optional: `email` (strict regex format), `parentName`, `address`, `targetBoard`, `targetStandard`, `targetCourse`, `source`.
  - Discarded: `status` (forced to `NEW`), `assignedToId` (forced to `null`), `notes` (forced to `null`), `followUpDate` (forced to `null`).
  - Centre verification: Client-supplied `centreId` is verified against active `Centre` rows; inactive or non-existent centres resolve to `null` (fails closed).
- **CAPTCHA / Turnstile**: If `process.env.TURNSTILE_SECRET_KEY` is present, the endpoint validates the Turnstile response token via Cloudflare's siteverify API.

### C. System Configuration Mutations (Priority 3)
- **Role Lockdown**: `PUT /setup/settings` and `PUT /syllabus-config` require `@Roles('SUPER_ADMIN')` evaluated by `RolesGuard`.
- **Non-Super Admin Rejection**: Centre Admins, Teachers, Students, and unauthenticated callers receive `403 Forbidden` or `false` from `RolesGuard`, leaving database state untouched.
- **Payload Sanitization**:
  - `/setup/settings`: Only `name`, `email`, `contactNo`, and `currentYear` are updated. Extra fields like `isAdmin`, `id`, `code`, or `status` are discarded.
  - `/syllabus-config`: Only whitelisted weight and threshold keys are accepted. Payloads containing only unrecognized fields are rejected with `400 Bad Request`.

---

## 5. Prisma Schema & Migration Artifacts

### Schema Diff (`packages/database/prisma/schema.prisma`)
```prisma
model StudyMaterial {
  id             String       @id @default(uuid())
  title          String
  type           MaterialType // e.g., PDF, VIDEO, LINK
  url            String?
  thumbnailUrl   String?
  academicYearId String
  syllabusId     String
  chapterId      String?
  topicId        String?
  subtopicId     String?
  uploaderId     String?
  centreId       String?
  isShared       Boolean      @default(false)
  ...
}
```

### Migrations
1. **`20261025_add_enquiry_and_studymaterial_centre/migration.sql`**:
   Adds `centreId TEXT` with foreign key constraints to `centres(id)` on delete set null, with schema-scoped idempotency:
   ```sql
   DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = CURRENT_SCHEMA
           AND table_name = 'enquiries'
           AND column_name = 'centreId'
       ) THEN
           ALTER TABLE "enquiries" ADD COLUMN "centreId" TEXT;
       END IF;
   END $$;
   ```

2. **`20261025_add_studymaterial_is_shared/migration.sql`**:
   Adds `isShared BOOLEAN NOT NULL DEFAULT false` to `study_materials`:
   ```sql
   DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = CURRENT_SCHEMA
           AND table_name = 'study_materials'
           AND column_name = 'isShared'
       ) THEN
           ALTER TABLE "study_materials" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
       END IF;
   END $$;
   ```

---

## 6. Ownership Reconciliation & Dry-Run Report

Two automated CLI scripts were implemented to safely reconcile legacy unassigned records. Both scripts default to **DRY-RUN mode** (no database mutations) unless `--apply` is passed.

### 1. Enquiry Reconciliation Script
- **File**: `packages/database/prisma/scripts/backfill-enquiry-centres.ts`
- **Execution Command**:
  ```bash
  # Dry-run inspection (default):
  pnpm --filter @educare/database reconcile:enquiries
  
  # Apply mode:
  pnpm --filter @educare/database reconcile:enquiries --apply
  ```
- **Reconciliation Rules**:
  - If `assignedTo` staff belongs to **exactly 1 centre**: Unambiguously resolved to that centre.
  - If `assignedTo` staff belongs to **>1 centre**: Ambiguous -> remains `centreId = null` (failing closed).
  - If `assignedToId` is null (unassigned lead): Ambiguous -> remains `centreId = null` (failing closed).

### 2. Study Material Reconciliation Script
- **File**: `packages/database/prisma/scripts/backfill-study-material-centres.ts`
- **Execution Command**:
  ```bash
  # Dry-run inspection (default):
  pnpm --filter @educare/database reconcile:materials
  
  # Apply mode:
  pnpm --filter @educare/database reconcile:materials --apply
  ```
- **Reconciliation Rules**:
  - If `targetTrack` has batches and all batches belong to **exactly 1 centre**: Unambiguously resolved to that track's centre.
  - If `targetTrack` spans batches across **>1 centre**: Ambiguous -> remains `centreId = null` (failing closed).
  - If no target track and uploader is `TEACHER`/`CENTRE_ADMIN` belonging to **exactly 1 centre**: Unambiguously resolved to uploader's centre.
  - If uploader is `SUPER_ADMIN`: Ambiguous -> requires Super Admin manual review to decide whether to set `isShared = true` or assign to a centre.

### Unresolved Records Dry-Run Summary (Local Disposable Database)
```
--- Enquiry Reconciliation Summary ---
Total Inspected: 0 (schema initialized cleanly)
Resolved via Unambiguous Single Staff Centre: 0
Ambiguous (Failing Closed for Safety): 0

--- Study Material Reconciliation Summary ---
Total Inspected: 0 (schema initialized cleanly)
Resolved via Unambiguous Target Track Centre: 0
Resolved via Unambiguous Uploader Centre: 0
Ambiguous (Failing Closed for Safety): 0
```
On a production or staging database with legacy data, executing the above commands will output structured tables of every ambiguous record requiring administrative attention without making any modifications.

---

## 7. Actual Test Commands & Pass/Fail Results

### 1. Dedicated Authorization Remediation Suite
- **Command**: `pnpm --filter api test -- src/common/authorization-remediation.spec.ts`
- **Result**: **PASS** (1 test suite, 50/50 tests passed, duration: 6.289 s)
  - Scope A — Staff Privilege Escalation: 6 passed
  - Scope B — Tenant Isolation (Support, Enquiries, Materials): 8 passed
  - Scope C — Syllabus Progress & Student Privacy: 6 passed
  - Public Route Bypass in Global Guards: 2 passed
  - Priority 1 — Fail-Closed Legacy Study Materials: 12 passed
  - Priority 2 — Public Enquiry Abuse Protection & Throttling: 6 passed
  - Priority 3 — Complete Configuration Authorization: 8 passed
  - Priority 4 — Ownership Reconciliation Scripts: 2 passed

### 2. Full Application Test Suite
- **Command**: `pnpm --filter api test`
- **Result**: **PASS** (17 test suites, 363/363 tests passed, duration: 79.2 s)
  - `src/attendance/attendance.controller.spec.ts`: PASS
  - `src/attendance/attendance.service.spec.ts`: PASS
  - `src/assignments/assignments.controller.spec.ts`: PASS
  - `src/assignments/assignments.service.spec.ts`: PASS
  - `src/fee/fee.controller.spec.ts`: PASS
  - `src/fee/fee.service.spec.ts`: PASS
  - `src/sms/sms.controller.spec.ts`: PASS
  - `src/sms/sms.service.spec.ts`: PASS
  - `src/report/report.controller.spec.ts`: PASS
  - `src/report/report.service.spec.ts`: PASS
  - `src/finance/finance.controller.spec.ts`: PASS
  - `src/finance/finance.service.spec.ts`: PASS
  - `src/enquiry/enquiry.controller.spec.ts`: PASS
  - `src/enquiry/enquiry.service.spec.ts`: PASS
  - `src/app.controller.spec.ts`: PASS
  - `src/common/security-regression.spec.ts`: PASS (298/298 passed)
  - `src/common/authorization-remediation.spec.ts`: PASS (50/50 passed)

### 3. NestJS Production Build
- **Command**: `pnpm --filter api build`
- **Result**: **PASS** (exit code 0, 0 TypeScript compilation errors)

---

## 8. Tests That Failed or Could Not Run

- **Failed Tests**: None (0 failed).
- **Blocked/Skipped Tests**: None. All 17 test suites and 363 test cases executed completely.

---

## 9. Remaining Deployment Configuration Requirements

To achieve full production readiness when deploying to horizontally scaled environments:

1. **Redis URL for Distributed Throttling**:
   - `AppModule` is pre-configured with `ThrottlerStorageRedisService(process.env.REDIS_URL)`.
   - In production, ensure `REDIS_URL` (e.g. `rediss://...`) is configured across all API container instances. This ensures rate-limiting counters are shared across replicas.
2. **Reverse Proxy Trust & IP Headers**:
   - For applications behind Cloudflare, AWS ALB, or NGINX, configure Express `trust proxy` settings in `main.ts` with the specific CIDR ranges of trusted proxies.
   - `StrictThrottlerGuard` relies on the socket remote address, which is secure by default against client header spoofing.
3. **Cloudflare Turnstile Key**:
   - To activate CAPTCHA verification on the public admission form, set `TURNSTILE_SECRET_KEY` in production environment variables.

---

## 10. Remaining Authorization & Data-Isolation Risks

1. **Ambiguous Legacy Records in Production**:
   - Any legacy records with `centreId = null` will fail closed for students and teachers. Administrators must inspect `/api/enquiry/unreconciled` and `/api/study-materials/unreconciled` after migration to assign them to intended centres or flag them as `isShared = true`.
2. **Multi-Centre Student Disambiguation in Support Tickets**:
   - When a student enrolled across multiple centres files a support ticket, the ticket is visible to Centre Admins of all centres where the student has an active batch enrollment. Adding an explicit `centreId` dropdown on the student support submission form will allow single-centre routing if required by institution policy.
