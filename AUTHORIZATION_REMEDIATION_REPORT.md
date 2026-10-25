# EduCare LMS — Comprehensive Authorization Hardening & Final Consistency Report

## 1. Executive Summary

This report documents the security audit, authorization remediation, and release-gate consistency review completed on the `fix/authorization-remediation` branch of the `educare_lms` repository.

In response to the trusted enquiry origin review and final release-gate requirements, all authorization rules, verification paths, and backfill scripts were audited against actual source code, Prisma models, migrations, and test runs:

1. **Trusted Enquiry Origin & Prevention of Forged Ownership (Section 4)**:
   - **Client Inputs Untrusted**: Client-submitted `centreId`, `source`, and `assignedToId` on public endpoints (`POST /api/enquiry/public`) are treated as untrusted and cannot dictate tenant ownership.
   - **Form-Derived Ownership**: Tenant ownership (`centreId`) is derived strictly server-side when a submission references a verified active `CustomForm` that has an active configured centre.
   - **Separation of Attribution vs Ownership**: Legitimate marketing/intake attribution (`source`) is preserved as a descriptive text field (e.g. `'Website Form'`, `'Walk-in'`) but is **never** used to infer or assign tenant ownership.
   - **Fail-Closed Unassigned Intake**: Generic public admissions (such as `/admission`) that lack a centre-configured form are preserved with `centreId = null`, isolated from single-centre staff, and surfaced solely to Super Admins.

2. **Hardened Enquiry Reconciliation & Audited Manual Workflow (Section 5)**:
   - **Elimination of Unsafe Script Backfills**: Removed all automatic assignment based on free-text `source.startsWith('Centre: ...')` and staff assignment in `backfill-enquiry-centres.ts`.
   - **Fail-Closed Legacy Records**: Legacy enquiries lacking authoritative server-persisted relationships remain unassigned (`centreId = null`) in both dry-run and apply modes.
   - **Audited Manual Reconciliation**: Implemented a dedicated Super Admin manual reconciliation workflow (`POST /api/enquiry/:id/reconcile`) that validates target centre status and creates non-repudiable audit logs via `AuditService`.
   - **Zero Dry-Run Mutations**: Dry-run mode (`dryRun = true`) is guaranteed to perform zero database updates.

3. **Decoupling Content Read/Playback from Management Rights (Section 6)**:
   - **Public Read vs Management**: Explicit public publication (`isPublic = true`) allows marketing previews for prospective learners and enrolled students, but **never** confers edit, update, or deletion rights to non-super admins.
   - **Super Admin Governance**: Only `SUPER_ADMIN` can set, modify, or delete `isPublic = true` or `isShared = true` materials. Centre Admins and Teachers can only manage private materials within their authorized centres and assigned subjects/standards.

4. **Hardened Cloudflare Turnstile Verification (Section 7)**:
   - **Frontend-Only Hostname Allowlist**: Restricted allowed hostnames to public frontends (`lms.educarelearning.in`, `educarelearning.in`), excluding `api.educarelearning.in`.
   - **Hostname Normalization**: Strips URL schemes, ports, and trailing paths before allowlist evaluation.
   - **Mandatory Exact Action Matching**: Strictly requires `action` to match `'admission_enquiry'`, rejecting omitted or mismatched actions.
   - **Fail-Closed Production Posture**: Rejects requests if `TURNSTILE_SECRET_KEY` is missing in production environments; redacts secrets and raw tokens from logs and error payloads.

5. **Test Suite Reconciliation & Verification (Section 9)**:
   - **Full Repository Test Suite**: **17 test suites, 414 tests passed, 0 failed, 0 skipped, 0 blocked**.
   - **Suite Composition**:
     - Dedicated Remediation Suite (`authorization-remediation.spec.ts`): **101 tests passed** (including 10 new Scope J trusted origin and reconciliation tests).
     - Security Regression Suite (`security-regression.spec.ts`): **298 tests passed**.
     - Core Domain Unit Suites: **15 tests passed** across 15 suites.
   - **Build & Schema**: Validated Prisma schema, generated Prisma client, and compiled NestJS API with 0 TypeScript errors.

---

## 2. Branch Name and Working-Tree Status

- **Git Branch**: `fix/authorization-remediation`
- **Base Branch**: `main`
- **Commit Author**: `nonstradamoz <nonstradamoz@users.noreply.github.com>`
- **Working-Tree Status**: Clean, fully compiled, all 17 test suites passing (414/414 tests).

---

## 3. Files Changed and Rationale

| File Path | Component | Rationale & Change Summary |
| :--- | :--- | :--- |
| `apps/api/src/enquiry/enquiry.service.ts` | Enquiry Service | Derives `centreId` strictly from active verified `CustomForm` configurations; rejects conflicting client `centreId`; strips client-supplied `assignedToId`; isolates attribution `source` from tenant ownership; implements audited `reconcileEnquiry` for Super Admins. |
| `apps/api/src/enquiry/enquiry.controller.ts` | Enquiry Controller | Added `POST :id/reconcile` endpoint restricted to `SUPER_ADMIN`; bound `GET unreconciled` to Super Admin user context. |
| `apps/api/src/enquiry/enquiry.module.ts` | Enquiry Module | Imported `AuditModule` to enable audit recording during manual enquiry reconciliation. |
| `packages/database/prisma/scripts/backfill-enquiry-centres.ts` | Reconciliation CLI | Eliminated automatic backfill from free-text `source` and staff assignment; guarantees ambiguous records remain `centreId = null` in both dry-run and apply modes. |
| `apps/api/src/common/authorization-remediation.spec.ts` | Test Suite | Added Scope J containing 10 comprehensive regression tests for trusted origin derivation, forged input rejection, dry-run/apply safety, and Super Admin reconciliation. Suite expanded to 101 tests. |
| `apps/api/src/study-materials/study-materials.service.ts` | Study Material Service | Decoupled `isPublic` (public read/preview) from mutation rights (Super Admin only). Governs `isShared` and `isPublic` flags. |
| `apps/api/src/study-materials/study-materials.controller.ts` | Study Material Controller | Binds `getPlayUrl` to `StudyMaterialsService.getById(id, req.user)` to enforce tenant boundaries on streaming playback URLs. |
| `apps/api/src/common/guards/strict-throttler.guard.ts` | Rate Limit Guard | Enforces socket-based tracking for direct untrusted connections, CIDR subnet matching, and fail-closed `HTTP 503` on Redis outages. |
| `packages/database/prisma/schema.prisma` | Database Schema | Model contains `isPublic: Boolean @default(false)` on `StudyMaterial` and `centreId: String?` on `CustomForm`. |
| `packages/database/prisma/migrations/20261025_add_studymaterial_is_public/migration.sql` | Migration SQL | Schema-guarded idempotent migration adding `"isPublic" BOOLEAN NOT NULL DEFAULT false` to `study_materials`. |

---

## 4. Final Source of Truth for Enquiry Ownership

### A. Threat Model & Forged Ownership Defense
In multi-tenant CRM architectures, public enquiry endpoints (`POST /api/enquiry/public`) are exposed to unauthenticated users. If an endpoint accepts client-submitted `centreId`, `assignedToId`, or parses free-text `source` values (e.g. `source: "Centre: centre-B"`), attackers can:
1. Force leads into a rival branch's CRM pipeline.
2. Route prospects to specific compromised counsellor accounts.
3. Poison backfill reconciliation scripts that scan metadata fields.

### B. Ownership Derivation Rules
1. **Untrusted Client Inputs**:
   - `centreId`: A client-submitted `centreId` is **never** accepted on public intake simply because the centre exists or is active.
   - `assignedToId`: Always stripped and forced to `null` on public intake.
   - `source`: Stored as pure attribution text (e.g. `'Website Form'`, `'Referral'`). It is **never** parsed for tenant keywords or used to infer `centreId`.
2. **Authoritative Server Derivation via Verified Forms**:
   - When a public submission provides `formId`:
     - The server looks up `CustomForm` in the database.
     - Verifies `form.isActive === true`.
     - Verifies `form.centreId` exists and points to an `ACTIVE` centre.
     - Derives `targetCentreId = form.centreId`.
   - If client also supplies a conflicting `centreId`, the request is **rejected** with `HTTP 400 Bad Request ('Client-supplied centreId conflicts with verified form configuration.')`.
3. **Preservation of Generic Admission Workflows**:
   - Generic public forms (e.g. `/admission`) that do not reference a centre-bound form are created with `centreId = null, status = NEW`.
   - Records remain safely unassigned and accessible only to Super Admins.

### C. Attribution vs Tenant Ownership Separation
- **Source Attribution (`source: String?`)**: Represents the marketing channel or lead mechanism (e.g. `'Walk-in'`, `'Facebook Ad'`, `'Website Form'`). Available to counsellors for conversion analytics.
- **Tenant Ownership (`centreId: String?`)**: Controls database row-level security and multi-tenant access scoping (`getAllEnquiries`, `getEnquirySummary`, `updateEnquiry`).

---

## 5. Hardened Ownership Reconciliation & Legacy Data Limitations

### A. Script Rules (`backfill-enquiry-centres.ts`)
1. **No Automatic Backfill from Free-Text `source`**:
   - Records with `source.startsWith('Centre: ...')` are treated as untrusted client data and **not** backfilled.
2. **No Automatic Backfill from Staff Assignment**:
   - Staff assignment represents post-intake operational routing and does not prove geographic intake origin.
   - Single-centre staff assignment is noted in summary tables as an investigative suggestion (`suggestedCentreId`) but does **not** update the database.
3. **Fail-Closed Execution**:
   - All unassigned records lacking authoritative server-persisted relationships remain unassigned (`centreId: null`) in both dry-run and apply modes.
4. **Dry-Run Integrity**:
   - In dry-run mode (`dryRun = true`), `client.enquiry.update` is never invoked.

### B. Super Admin Manual Reconciliation Workflow
To reconcile legacy or unassigned records, Super Admins use the authorized reconciliation API:
- **Endpoint**: `POST /api/enquiry/:id/reconcile`
- **Authorization**: `@Roles('SUPER_ADMIN')` + server-side verification (`isSuperAdmin(currentUser)`). Denies `CENTRE_ADMIN`, `TEACHER`, and unauthorized callers with `HTTP 403 Forbidden`.
- **Validation**: Requires `centreId`; verifies target centre exists and `status === 'ACTIVE'`.
- **Auditing**: Creates an audit log entry via `AuditService` (`action: 'RECONCILE_ENQUIRY_OWNERSHIP'`).

### C. Data Model Limitations
- In the current schema, `Enquiry` has no foreign key to `CustomForm`. Therefore, legacy enquiries created before form linking cannot be automatically backfilled without guessing.
- Keeping legacy records unassigned (`centreId = null`) until Super Admin review is the only mathematically fail-closed policy.

---

## 6. Content vs Management Permission Matrix

### A. Read & Playback Matrix
| Content Scope | `SUPER_ADMIN` | `CENTRE_ADMIN` | `TEACHER` | Enrolled `STUDENT` | Unenrolled `STUDENT` | `PUBLIC_LEARNER` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`isPublic = true`** | **Allowed** | **Allowed** | **Allowed** | **Allowed** (Preview) | **Allowed** (Preview) | **Allowed** (Preview) |
| **`isShared = true` & `isPublic = false`** | **Allowed** | **Allowed** | **Allowed** (If assigned) | **Allowed** (Cross-Centre) | **Denied (`403`)** | **Denied (`403`)** |
| **Centre-Specific (`centreId = X`)** | **Allowed** | **Allowed** (Centre X) | **Allowed** (Centre X & assigned) | **Allowed** (Centre X & course enrolled) | **Denied (`403`)** | **Denied (`403`)** |
| **Track-Specific (`targetTrackId = T`)** | **Allowed** | **Allowed** (Track T) | **Allowed** (Teaching Track T batch) | **Allowed** (Student in Track T batch) | **Denied (`403`)** | **Denied (`403`)** |
| **Unreconciled (`centreId = null, isShared = false, isPublic = false`)** | **Allowed** (Audit) | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |

### B. Management & Mutation Matrix (Create, Update, Delete, Share, Publish)
| Action | `SUPER_ADMIN` | `CENTRE_ADMIN` | `TEACHER` | `STUDENT` / `PUBLIC_LEARNER` |
| :--- | :--- | :--- | :--- | :--- |
| **Create Centre Material** | Allowed (Any centre) | Allowed (Own centre only) | Allowed (Own centre & assigned teaching) | **Denied (`403`)** |
| **Set `isShared = true`** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Set `isPublic = true`** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Update Public Material** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Delete Public Material** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Update Shared Material** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Delete Shared Material** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Update Centre Material** | Allowed | Allowed (Own centre only) | Allowed (Own upload only, assigned) | **Denied (`403`)** |
| **Delete Centre Material** | Allowed | Allowed (Own centre only) | Allowed (Own upload only) | **Denied (`403`)** |

- **Security Invariant**: `isPublic = true` grants playback access only. It never grants modification or deletion rights to non-super admins.

---

## 7. Cloudflare Turnstile Verification Policy

1. **Frontend Hostname Allowlist**:
   - `defaultHostnames = ['lms.educarelearning.in', 'educarelearning.in']`.
   - `api.educarelearning.in` is omitted because widgets are rendered exclusively on web frontends.
   - Hostnames are normalized (protocol, port, and trailing paths stripped).
2. **Mandatory Exact Action Matching**:
   - Siteverify response must include `action: 'admission_enquiry'`. Tokens with missing or mismatched actions are rejected.
3. **Fail-Closed Error Handling**:
   - Missing or blank token: `400 Bad Request`.
   - Expired or duplicate token (`timeout-or-duplicate`): `400 Bad Request ('token expired or already used.')`.
   - Upstream 5xx or invalid JSON: `400 Bad Request ('CAPTCHA verification service returned an error.')`.
   - Production without `TURNSTILE_SECRET_KEY`: `500 Server Configuration Error`.
4. **Zero-Leak Logging**:
   - Turnstile secrets, response tokens, and user credentials are encrypted or omitted from server logs and error bodies.

---

## 8. Reverse-Proxy Trust & Distributed Rate Limiting

1. **Direct Untrusted Connection Defense**:
   - Direct TCP connections not matching `TRUSTED_PROXIES` strictly discard `X-Forwarded-For` and `CF-Connecting-IP` headers and track limits via `req.socket.remoteAddress`.
2. **Trusted Ingress Extraction**:
   - When the connecting peer matches a trusted proxy CIDR, forwarding headers are extracted and sanitized with `IP_REGEX`.
3. **CIDR Restriction Warning**:
   - Broad RFC 1918 CIDRs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) must not be trusted globally in environments where internal workloads share the network. In production/staging, `TRUSTED_PROXIES` must be scoped strictly to the ingress controller or load balancer VPC subnet.
4. **Distributed Redis Rate Limiting & Fail-Closed Storage**:
   - Limit counters are synchronized across API instances via Redis.
   - If Redis becomes unreachable, `StrictThrottlerGuard` throws `HTTP 503 Service Unavailable`, preventing unthrottled access during infrastructure degradation.

---

## 9. Actual Test Execution & Reconciled Results

### A. Reconciled Test Breakdown

| Test Suite / Category | File Path | Passed Tests | Failed | Skipped | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dedicated Authorization Remediation Suite** | `src/common/authorization-remediation.spec.ts` | **101** | 0 | 0 | **PASS** |
| **Comprehensive Security Regression Suite** | `src/common/security-regression.spec.ts` | **298** | 0 | 0 | **PASS** |
| **Enquiry Service Unit Tests** | `src/enquiry/enquiry.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Enquiry Controller Unit Tests** | `src/enquiry/enquiry.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Finance Service Unit Tests** | `src/finance/finance.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Finance Controller Unit Tests** | `src/finance/finance.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Attendance Service Unit Tests** | `src/attendance/attendance.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Attendance Controller Unit Tests** | `src/attendance/attendance.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Assignments Service Unit Tests** | `src/assignments/assignments.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Assignments Controller Unit Tests** | `src/assignments/assignments.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **SMS Service Unit Tests** | `src/sms/sms.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **SMS Controller Unit Tests** | `src/sms/sms.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Report Service Unit Tests** | `src/report/report.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Report Controller Unit Tests** | `src/report/report.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Fee Service Unit Tests** | `src/fee/fee.service.spec.ts` | **1** | 0 | 0 | **PASS** |
| **Fee Controller Unit Tests** | `src/fee/fee.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **App Controller Unit Tests** | `src/app.controller.spec.ts` | **1** | 0 | 0 | **PASS** |
| **TOTAL** | **17 Test Suites** | **414** | **0** | **0** | **PASS** |

### B. Scope J Regression Test Breakdown (10/10 Passed)
- **Case 1**: Free-text `source: "Centre: centre-B"` does not assign record to centre B (`centreId: null`).
- **Case 2**: Forged `centreId` is not accepted as authoritative (`centreId: null`).
- **Case 3**: Forged `assignedToId` is discarded on intake (`assignedToId: null`).
- **Case 4**: Active form configured for centre A derives `centreId: 'centre-alpha'`.
- **Case 5**: Form without configured centre creates unassigned enquiry (`centreId: null`).
- **Case 6**: Inactive or invalid form cannot establish centre ownership; conflicting client `centreId` is rejected (`400 Bad Request`).
- **Case 7**: Post-intake staff assignment does not cause automatic backfill in apply mode.
- **Case 8**: Dry-run reconciliation performs zero database mutations.
- **Case 9**: Apply-mode reconciliation leaves records with forged source or ambiguous metadata unchanged.
- **Case 10**: Unauthorized users denied from unreconciled endpoint and manual reconciliation (`403 Forbidden`); Super Admin succeeds and audits action.

### C. Build & Prisma Verification
1. **Prisma Schema Validation**:
   - Command: `pnpm --filter @educare/database exec prisma validate`
   - Outcome: `The schema at prisma/schema.prisma is valid 🚀`
2. **Prisma Client Generation**:
   - Command: `pnpm --filter @educare/database db:generate`
   - Outcome: `✔ Generated Prisma Client (v5.19.1)`
3. **API Production Build**:
   - Command: `pnpm --filter api build`
   - Outcome: Compiled cleanly with exit code 0 and 0 TypeScript errors.

---

## 10. Staging Preparation Checklist

Before deploying changes to production, execute the following operational checks in staging:

- [ ] **1. Apply Migrations to Staging Database Copy**:
  - Run `prisma migrate deploy` against a restored copy of production data:
    ```bash
    pnpm --filter @educare/database prisma migrate deploy
    ```
  - Verify that the `"isPublic"` column on `study_materials` defaults to `false` without locking tables or degrading read performance.
- [ ] **2. Inspect Unreconciled Enquiry and Study Material Records**:
  - Run the reconciliation scripts in dry-run mode against the staging database:
    ```bash
    pnpm --filter @educare/database reconcile:enquiries
    pnpm --filter @educare/database reconcile:materials
    ```
  - Confirm that zero mutations occur and review the ambiguous records summary table.
- [ ] **3. Test Centre A vs Centre B Authorization Isolation**:
  - Log in as Centre Admin A and verify inability to read or mutate Centre B enquiries, study materials, forms, or fee records.
  - Verify that an unreconciled enquiry (`centreId = null`) cannot be viewed or updated by Centre Admin A or Centre Admin B.
- [ ] **4. Validate Reverse-Proxy Headers and Rate Limiting**:
  - Confirm that the ingress proxy (e.g. AWS ALB, Cloudflare, NGINX) unconditionally strips incoming client `X-Forwarded-For` and `CF-Connecting-IP` headers and appends genuine client IPs.
  - Test rate limiting across 2+ API instances with Redis storage enabled.
  - Temporarily pause Redis to verify that `StrictThrottlerGuard` throws `HTTP 503` (fails closed).
- [ ] **5. Cloudflare Turnstile Live Roundtrip**:
  - Execute a live submission on `/admission` using staging credentials.
  - Verify token generation, siteverify roundtrip, hostname allowlisting, and action matching (`admission_enquiry`).
- [ ] **6. Unresolved Ownership Containment**:
  - Verify that legacy study materials with `centreId = null` and legacy enquiries with `centreId = null` are visible exclusively to Super Admins via `/api/study-materials/unreconciled` and `/api/enquiry/unreconciled`.
