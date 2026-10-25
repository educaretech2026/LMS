# EduCare LMS — Comprehensive Authorization Hardening & Final Consistency Report

## 1. Executive Summary

This report documents the security audit, authorization remediation, and release-gate consistency review completed on the `fix/authorization-remediation` branch of the `educare_lms` repository.

In response to the final release-gate review, every authorization rule, verification path, and script was audited against actual source code, Prisma models, migrations, and test runs:

1. **Test Suite Reconciliation (Section 8)**:
   - **Discrepancy Source Identified**: The previous report noted 89 remediation tests and 298 security regression tests alongside a stated total of 402 passing tests ($89 + 298 = 387$). The difference of **15 passing tests** represents the baseline unit tests across the 15 other core test suites in `apps/api/src/` (`attendance`, `assignments`, `fee`, `sms`, `report`, `finance`, `enquiry`, and `app`).
   - **Current Verified Total**: With 2 additional Turnstile security tests added in this verification cycle, the complete API test runner executes **17 test suites**, resulting in **404 passed tests, 0 failed, 0 skipped, 0 blocked** ($91 + 298 + 15 = 404$).

2. **Hardened Cloudflare Turnstile Verification (Section 6)**:
   - **Frontend-Only Hostname Allowlist**: Removed `api.educarelearning.in` from the default hostname allowlist because the widget is rendered exclusively on public web frontends (`lms.educarelearning.in` and `educarelearning.in`).
   - **Safe Hostname Normalization**: Strips URL schemes, ports, and trailing paths before comparing against the allowlist.
   - **Mandatory Exact Action Validation**: Rejects tokens where the siteverify response omits `action` or where `action` does not strictly match `'admission_enquiry'`.
   - **Zero Secret Exposure**: Tokens, secret keys, and client credentials are fully redacted and never logged or exposed in client error responses.
   - **Fail-Closed Production Posture**: Rejects requests if `TURNSTILE_SECRET_KEY` is not configured in production environments.

3. **Elimination of Unsafe Enquiry Staff-Assignment Backfills (Section 7)**:
   - **Business Invariant**: Public admission enquiries are submitted without centre binding (`centreId = null, status = NEW`). Staff assignments are post-intake operational CRM routing and do **not** constitute proof of geographic origin.
   - **Script Hardening**: Removed `--trust-staff-assignment` as an automatic ownership-assignment mechanism in `backfill-enquiry-centres.ts`.
   - **Authoritative Origin Requirement**: Centre ownership is assigned **only** when unambiguous, authoritative originating metadata is present in the record (e.g. `source.startsWith('Centre: <centreId>')`).
   - **Fail-Closed Unresolved Records**: Records with staff assignment but no authoritative source metadata are preserved with `centreId = null` and surfaced exclusively to Super Admins (`GET /api/enquiry/unreconciled`) for manual reconciliation.
   - **Dry-Run Integrity**: Dry-run mode (`dryRun = true`) is guaranteed to perform zero database mutations.

4. **Clarification of Content vs Management Permissions (Section 4)**:
   - **Read/Playback vs Management Decoupling**: Separate permissions are enforced for public preview playback (`isPublic = true`), cross-centre institutional sharing (`isShared = true`), centre-specific access (`centreId = X`), and mutations (create, update, delete, share, publish).
   - **Non-Super-Admin Mutation Prevention**: `isPublic = true` grants preview read access to learners, but **never** grants editing or deletion permissions to non-super admins. Only `SUPER_ADMIN` can set, modify, or delete public or globally shared study materials.
   - **Private Institutional Content**: Non-public content requires student course enrolment and teacher subject/standard assignment.

5. **Proxy Trust and Distributed Rate Limiting (Section 5)**:
   - **Strict Untrusted Connection Defense**: When an incoming TCP connection does not originate from a trusted proxy CIDR defined in `TRUSTED_PROXIES`, client-supplied forwarding headers (`X-Forwarded-For`, `CF-Connecting-IP`) are discarded, deriving rate-limit trackers strictly from `req.socket.remoteAddress`.
   - **Fail-Closed Redis Storage**: If distributed Redis rate-limiting storage becomes unavailable, `StrictThrottlerGuard` throws `HTTP 503 Service Unavailable`, preventing unthrottled brute-force attempts during infrastructure degradation.
   - **CIDR Caution**: Broad private CIDRs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) must be scoped in staging/production to the exact Kubernetes/VPC ingress subnet.

---

## 2. Branch Name and Working-Tree Status

- **Git Branch**: `fix/authorization-remediation`
- **Base Branch**: `main`
- **Commit Author**: `nonstradamoz <nonstradamoz@users.noreply.github.com>`
- **Working-Tree Status**: Clean, fully compiled, all 17 test suites passing (404/404 tests).

---

## 3. Files Changed and Rationale

| File Path | Component | Rationale & Change Summary |
| :--- | :--- | :--- |
| `apps/api/src/enquiry/enquiry.service.ts` | Enquiry Service | Hardened Turnstile verification: removed `api.educarelearning.in` from allowlist, added hostname normalization, enforced mandatory exact action matching (`admission_enquiry`), and maintained zero-leak error handling. |
| `packages/database/prisma/scripts/backfill-enquiry-centres.ts` | Reconciliation CLI | Eliminated `--trust-staff-assignment` automatic backfill. Restricts automatic centre assignment to authoritative originating metadata (`source: 'Centre: ...'`). Single-centre staff assignment is logged as an investigative suggestion only; dry-run executes 0 mutations. |
| `apps/api/src/study-materials/study-materials.service.ts` | Study Material Service | Enforces strict separation between read/playback rights and management rights. `isPublic = true` allows learner read/playback but explicitly forbids update/delete by non-super admins. Governs `isShared` and `isPublic` mutations under `SUPER_ADMIN`. |
| `apps/api/src/study-materials/study-materials.controller.ts` | Study Material Controller | Binds `getPlayUrl` to `StudyMaterialsService.getById(id, req.user)` to guarantee video stream downloads enforce identical tenant and role authorization boundaries. |
| `apps/api/src/common/guards/strict-throttler.guard.ts` | Rate Limit Guard | Enforces socket-based tracking for untrusted direct connections, validates trusted proxy CIDRs, and implements fail-closed `HTTP 503` on Redis outages. |
| `apps/api/src/common/authorization-remediation.spec.ts` | Test Suite | Added regression tests verifying Turnstile rejection when widget action is omitted, Turnstile rejection for non-frontend hostnames (`api.educarelearning.in`), and proof that staff assignment alone cannot backfill centre ownership. Suite expanded to 91 passing tests. |
| `packages/database/prisma/schema.prisma` | Database Schema | Contains explicit `isPublic: Boolean @default(false)` attribute on `StudyMaterial` to decouple public marketing previews from institutional sharing. |
| `packages/database/prisma/migrations/20261025_add_studymaterial_is_public/migration.sql` | Migration SQL | Schema-guarded idempotent migration adding `"isPublic" BOOLEAN NOT NULL DEFAULT false` to `study_materials`. |

---

## 4. Distinct Study-Material Permission Matrix: Read vs Management

The following matrix defines the boundaries between viewing/playing content and managing/mutating content:

### A. Read & Playback Access Matrix

| Content Scope | `SUPER_ADMIN` | `CENTRE_ADMIN` | `TEACHER` | Enrolled `STUDENT` (Matching Course) | Unenrolled `STUDENT` | `PUBLIC_LEARNER` / Unauthenticated |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`isPublic = true`** | **Allowed** | **Allowed** | **Allowed** | **Allowed** (Preview) | **Allowed** (Preview) | **Allowed** (Preview) |
| **`isShared = true` & `isPublic = false`** | **Allowed** | **Allowed** (Global) | **Allowed** (If assigned to subject/standard) | **Allowed** (Cross-Centre) | **Denied (`403`)** | **Denied (`403`)** |
| **Centre-Specific (`centreId = X`)** | **Allowed** | **Allowed** (Centre X only) | **Allowed** (Centre X & assigned) | **Allowed** (Centre X & course enrolled) | **Denied (`403`)** | **Denied (`403`)** |
| **Track-Specific (`targetTrackId = T`)** | **Allowed** | **Allowed** (If Track T in centre) | **Allowed** (If teaching batch in Track T) | **Allowed** (If student batch in Track T) | **Denied (`403`)** | **Denied (`403`)** |
| **Unreconciled Legacy (`centreId = null, isShared = false, isPublic = false`)** | **Allowed** (Audit & Reconcile) | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |

### B. Management & Mutation Access Matrix (Create, Update, Delete, Share, Publish)

| Operation | `SUPER_ADMIN` | `CENTRE_ADMIN` | `TEACHER` | `STUDENT` / `PUBLIC_LEARNER` |
| :--- | :--- | :--- | :--- | :--- |
| **Create Centre-Scoped Material** | Allowed (Any centre) | Allowed (Own centre only) | Allowed (Own centre & assigned teaching scope) | **Denied (`403`)** |
| **Set `isShared = true` on Create/Update** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Set `isPublic = true` on Create/Update** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Update Public Material (`isPublic = true`)** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Delete Public Material (`isPublic = true`)** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Update Shared Material (`isShared = true`)** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Delete Shared Material (`isShared = true`)** | **Allowed** | **Denied (`403`)** | **Denied (`403`)** | **Denied (`403`)** |
| **Update Centre Material (`isPublic = false, isShared = false`)** | Allowed | Allowed (Own centre only) | Allowed (Own uploads only, matching assignment) | **Denied (`403`)** |
| **Delete Centre Material (`isPublic = false, isShared = false`)** | Allowed | Allowed (Own centre only) | Allowed (Own uploads only) | **Denied (`403`)** |

### Core Security Rules:
1. `isPublic = true` grants **read and playback access only**. It does **not** confer edit, update, reassign, or delete permissions to teachers or centre admins.
2. Only `SUPER_ADMIN` can create, update, or delete `isPublic = true` or `isShared = true` study materials.
3. Private institutional materials strictly require verified course enrolment (for students) and verified subject/standard teaching assignments (for teachers).

---

## 5. Reverse-Proxy Trust & Distributed Rate Limiting

### Network Ingress Model & Header Evaluation

```
[ Direct Untrusted Client ] ---- (TCP: 198.51.100.42) ----> [ NestJS StrictThrottlerGuard ]
  Headers: X-Forwarded-For: 8.8.8.8, CF-Connecting-IP: 1.1.1.1
  Socket Remote IP: 198.51.100.42 (NOT in TRUSTED_PROXIES)
  => Headers strictly discarded; Tracker Derived: 198.51.100.42 (Spoofing IMPOSSIBLE)

[ Genuine Visitor ] ----> [ Cloudflare / Ingress Proxy ] ---- (TCP: 10.0.1.5) ----> [ NestJS StrictThrottlerGuard ]
  Headers: CF-Connecting-IP: 203.0.113.10
  Socket Remote IP: 10.0.1.5 (Matches TRUSTED_PROXIES ingress subnet)
  => Header extracted & sanitized; Tracker Derived: 203.0.113.10
```

1. **Proxy Trust Enforcement**:
   - `TRUSTED_PROXIES` configures an allowlist of trusted IP addresses and CIDR subnets.
   - Direct TCP socket address (`req.socket.remoteAddress`) is verified against the trusted proxy list.
   - If the connecting socket is not a trusted proxy, all forwarding headers are discarded, preventing spoofed IP injection.
2. **CIDR Restriction Warning**:
   - Do not trust broad RFC 1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) in production environments unless the application is deployed within an isolated private network where untrusted workloads cannot open TCP connections to the API. In public or shared VPCs, configure `TRUSTED_PROXIES` strictly with the ingress subnet or load balancer IPs.
3. **Distributed Rate Limiting with Fail-Closed Storage**:
   - Rate limit trackers are synchronized across API instances via Redis storage.
   - If Redis becomes unreachable, `StrictThrottlerGuard.canActivate()` catches the error and throws `503 Service Unavailable`, preventing attackers from bypassing rate limits by degrading Redis infrastructure.

---

## 6. Complete Cloudflare Turnstile Verification Policy

1. **Frontend-Only Hostname Allowlist**:
   - Tokens must originate from hostnames where the widget is genuinely rendered:
     ```typescript
     const defaultHostnames = ['lms.educarelearning.in', 'educarelearning.in'];
     ```
   - `api.educarelearning.in` is excluded because the widget is not embedded on API domain endpoints.
   - Hostnames are normalized (protocol, port, and trailing paths stripped) before allowlist matching.
2. **Mandatory Exact Action Matching**:
   - The siteverify response must include `action` matching `'admission_enquiry'`:
     ```typescript
     if (!verifyData.action || String(verifyData.action).trim() !== expectedAction) {
       throw new BadRequestException('CAPTCHA verification failed: widget action missing or mismatched.');
     }
     ```
   - Tokens with omitted actions or actions from different forms/widgets are rejected.
3. **Response Status & Error Code Parsing**:
   - Rejects non-200 HTTP responses and malformed JSON payloads.
   - If `success === false` and error codes contain `timeout-or-duplicate`, responds with: `'CAPTCHA verification failed: token expired or already used.'`.
   - General failures return: `'CAPTCHA verification failed. Please try again.'`.
4. **Zero-Leakage Security Posture**:
   - Turnstile secret keys and client response tokens are omitted from server logs and client-facing error responses.
   - In production, missing `TURNSTILE_SECRET_KEY` fails closed (`HTTP 500 Server Configuration Error`).

---

## 7. Ownership Reconciliation Semantics & Origin Analysis

### Enquiry Origin Analysis
- Public enquiries submitted at `/admission` collect contact details without mandatory centre assignment (`centreId = null, status = NEW`).
- Staff assignment (`assignedToId`) occurs downstream during lead triage, counsellors frequently handle leads remotely across multiple centres, and leads are often reassigned between centres.
- **Decision**: Staff assignment alone does **not** prove originating centre ownership.

### Reconciliation Script Rules (`backfill-enquiry-centres.ts`)
1. **Authoritative Origin Assignment**:
   - Enquiries are backfilled to a centre **only** when unambiguous originating metadata is present in the record (e.g. `source.startsWith('Centre: <centreId>')`).
2. **Single-Centre Staff Assignment**:
   - Single-centre staff assignment is flagged as an investigative suggestion in summary logs (`suggestedCentreId`) but does **not** trigger automatic database backfill.
3. **Fail-Closed Unresolved Records**:
   - Enquiries lacking authoritative source tags remain unassigned (`centreId = null`) and are accessible solely to Super Admins via `GET /api/enquiry/unreconciled`.
4. **Dry-Run Mode**:
   - Dry-run mode (`dryRun = true`) is guaranteed to perform zero database mutations.

---

## 8. Actual Test Execution & Reconciled Results

### A. Test Count Reconciliation

| Test Suite / Category | Suite Path / Description | Passed Tests | Failed | Skipped | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dedicated Authorization Remediation Suite** | `src/common/authorization-remediation.spec.ts` | **91** | 0 | 0 | **PASS** |
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
| **TOTAL** | **17 Test Suites** | **404** | **0** | **0** | **PASS** |

### B. Exact Test Runner Command & Output Summary

- **Command**:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter api test -- --runInBand --forceExit
  ```
- **Real Runner Summary**:
  ```
  Test Suites: 17 passed, 17 total
  Tests:       404 passed, 404 total
  Snapshots:   0 total
  Time:        7.761 s
  Ran all test suites.
  ```

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

## 9. Outstanding Staging-Only Verification Requirements

Do not claim production readiness until the following operational checks have been validated in the staging environment:

1. **Ingress Proxy Header Overwrite Verification (Staging Infrastructure)**:
   - Verify that external ingress proxies (Cloudflare, AWS ALB, NGINX) unconditionally sanitize and overwrite incoming `X-Forwarded-For` and `CF-Connecting-IP` headers so that client-spoofed headers cannot reach `StrictThrottlerGuard`.
   - Confirm `TRUSTED_PROXIES` in staging matches the exact VPC ingress subnet.
2. **Live Cloudflare Turnstile Verification Roundtrip (Staging)**:
   - Perform live admission enquiry submissions with the Cloudflare Turnstile widget rendered on `lms.educarelearning.in` (or staging equivalent) using live Cloudflare API credentials.
3. **Reconciliation Dry-Run Against Staging Database Replica**:
   - Execute the backfill scripts against a sanitized staging replica of production data:
     ```bash
     pnpm --filter @educare/database prisma migrate deploy
     pnpm --filter @educare/database reconcile:enquiries
     pnpm --filter @educare/database reconcile:materials
     ```
   - Review all unassigned enquiries (`centreId = null`) with admissions leadership before applying manual reassignments.
