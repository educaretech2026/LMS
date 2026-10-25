# EduCare LMS — Authorization Remediation Report

## Executive Summary
This report documents the security fixes and multi-tenant authorization remediations implemented in the `educare_lms` repository on branch `fix/authorization-remediation`.

All changes strictly follow fail-closed security principles: client-supplied privileges, ownership IDs, roles, statuses, and centre contexts are never trusted; tenant boundaries are enforced across controllers, services, database models, and Prisma queries; and non-privileged administrative actors are strictly prevented from assigning, promoting, demoting, or modifying administrative accounts.

---

## Remediated Vulnerabilities & Scope Details

### Scope A — Staff Privilege Escalation Remediation
1. **POST `/api/staff` (Staff Creation)**:
   - Enforced server-side actor verification.
   - Non-super admins (`CENTRE_ADMIN`) are strictly restricted to provisioning `TEACHER` accounts only. Attempts to create `SUPER_ADMIN`, `CENTRE_ADMIN`, or arbitrary custom roles are immediately rejected with `403 Forbidden`.
   - The requested role is evaluated **before** database role or centre lookups, preventing information leakage and probing attacks.
   - Destination centre is verified against the actor's authorized centres via `assertCentreAccess`.
2. **PUT `/api/staff/:id` (Staff Update)**:
   - Target user role and centre memberships are loaded.
   - Non-super admins are forbidden from updating, promoting, or demoting `SUPER_ADMIN` or `CENTRE_ADMIN` accounts (`403 Forbidden`).
   - Non-super admins cannot assign any role other than `TEACHER` (`403 Forbidden`).
   - Target staff must belong to one of the caller's authorized centres; cross-centre edits are rejected with `403 Forbidden`.
   - If changing staff centre, the target centre is validated via `assertCentreAccess`.
3. **DELETE `/api/staff/:id` (Staff Deletion)**:
   - Non-super admins are forbidden from deleting `SUPER_ADMIN` or `CENTRE_ADMIN` accounts (`403 Forbidden`).
   - Staff deletion is strictly restricted to staff within the administrator's authorized centres (`403 Forbidden`).
4. **Sensitive Field Protection**:
   - Responses continue using `SAFE_USER_SELECT` (`passwordHash`, `resetPasswordToken`, and other sensitive fields are strictly excluded).

---

### Scope B — Real Tenant Isolation for Support Tickets, Enquiries, and Study Materials

#### 1. Support Tickets
- **Endpoint `GET /support/tickets/me`**:
  - Maintained strictly scoped to the authenticated caller (`where: { userId: req.user.id }`).
- **Endpoint `GET /support/tickets`**:
  - Injected authenticated caller `req.user` into `getAllTickets(user)`.
  - `SUPER_ADMIN`: Receives global ticket access.
  - `CENTRE_ADMIN`: Scoped to tickets where the ticket owner has a verified centre link in the administrator's authorized centres (`userCentres` for staff/admins, or `studentProfile.enrollments.batch.centreId` for students).
  - Fails closed (`[]`) if the administrator has no centre assignments or if ticket owners lack verified centre linkages.
- **Endpoint `PUT /support/tickets/:id/status`**:
  - Injected `req.user` into `updateTicketStatus(id, status, user)`.
  - Validates `status` against the `SupportTicketStatus` enum (`BadRequestException` on invalid values).
  - Loads the ticket alongside its owner's `userCentres` and student enrollment batches.
  - Verifies centre authorization before updating. Fails closed with `403 Forbidden` for out-of-scope tickets or unassociated users. Never updates by raw ID alone.

#### 2. Enquiries (CRM / Leads)
- **Data Model Migration**:
  - Added `centreId String?` and relation `centre Centre? @relation(fields: [centreId], references: [id], onDelete: SetNull)` to `Enquiry` model in `schema.prisma`.
  - Generated idempotent, non-destructive PostgreSQL migration: `packages/database/prisma/migrations/20261025_add_enquiry_and_studymaterial_centre/migration.sql`.
- **Public Form Creation (`POST /api/enquiry/public`)**:
  - Strict field whitelisting: only `studentName`, `parentName`, `contactNumber`, `email`, `address`, `source`, `targetBoard`, `targetStandard`, `targetCourse`, and `centreId` are accepted.
  - Client-supplied `status`, `assignedToId`, `notes`, and `followUpDate` are stripped. `status` is hardcoded to `EnquiryStatus.NEW`.
  - Destination `centreId` is validated against active centres in the database; invalid or inactive centres fail safely to `null`.
- **Authenticated CRUD (`POST /api/enquiry`, `GET /api/enquiry`, `GET /api/enquiry/summary`, `PATCH /api/enquiry/:id`)**:
  - Non-super admins derive or validate `centreId` from `currentUser.userCentres` via `assertCentreAccess`.
  - `getAllEnquiries` and `getEnquirySummary` filter by `where: { centreId: { in: authorizedCentres } }`.
  - `updateEnquiry` loads the enquiry within the authorized scope, verifies ownership, checks target centre on updates, and validates that any `assignedToId` belongs to the target centre.
- **Legacy Record Reconciliation Strategy**:
  - Implemented `GET /api/enquiry/unreconciled` for `SUPER_ADMIN`.
  - Detects records where `centreId` is `null`.
  - Unambiguous records (assigned staff belongs to exactly 1 centre) can be cleanly backfilled.
  - Ambiguous records (staff in multiple centres or no staff assigned) remain unassigned (`centreId = null`) and accessible only to `SUPER_ADMIN` until manually resolved.

#### 3. Study Materials & E-Study
- **Data Model Migration**:
  - Added `centreId String?` and relation `centre Centre? @relation(fields: [centreId], references: [id], onDelete: SetNull)` to `StudyMaterial` in `schema.prisma` and the migration script.
- **Identity & Authorization**:
  - `uploaderId` is bound strictly to `req.user.id`; client-supplied `uploaderId` is ignored.
  - Non-super admin material uploads validate that target track or `centreId` belongs to the caller's authorized centres.
  - Teacher uploads enforce that the teacher is actively assigned to the subject, standard, board, centre, and track.
  - Student access is limited to materials matching the student's enrolled courses, batches, and academic year.
- **E-Study Alignment**:
  - `EstudyController` (`/api/estudy`) now passes `req.user` to `EstudyService`.
  - `EstudyService` delegates to `StudyMaterialService`, eliminating authorization bypasses and unifying multi-tenant scoping.

---

### Scope C — Syllabus Progress and Configuration Permissions
1. **Controller Role Guards**:
   - Added `RolesGuard` and explicit `@Roles(...)` metadata across `SyllabusController` and `ConfigController`.
2. **Batch Progress Mutation Routes (`POST /syllabus/progress/chapter` & `POST /syllabus/progress/topic`)**:
   - Restricted to `@Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')`. Students are strictly forbidden (`403 Forbidden`).
   - Prior to mutation, verifies that the batch's `centreId` is within the actor's authorized centres.
   - For teachers, verifies teaching assignment against the batch.
   - Enforces syllabus hierarchy: validates that `chapterId` belongs to a syllabus matching the batch's `boardId` and `standardId`, and that `topicId` belongs to that chapter. Mismatches are rejected with `400 Bad Request`.
3. **Student Progress Privacy (`GET /syllabus/student-progress/:batchId/:studentId`)**:
   - Students may query **only** their own `StudentProfile` ID and **only** if actively enrolled in `batchId`. Cross-student queries are rejected with `403 Forbidden`.
   - Staff must be authorized for the batch's centre and assigned to teach the course.
4. **Learner Progress Events (`POST /syllabus/student-progress/event`)**:
   - Restricted to `@Roles('STUDENT', 'PUBLIC_LEARNER')`.
   - Verifies caller's active enrollment in the target batch.
   - Verifies topic belongs to the batch's syllabus.
5. **Batch Analytics (`GET /syllabus/analytics/:batchId`)**:
   - Restricted to staff roles (`SUPER_ADMIN`, `CENTRE_ADMIN`, `TEACHER`) with batch centre and assignment verification.
6. **Syllabus Configuration (`PUT /syllabus-config`)**:
   - Guarded with `RolesGuard` and restricted to `@Roles('SUPER_ADMIN')`.
   - Strict field whitelisting for update payload (numeric thresholds and intervals).
7. **Global Setup Settings (`PUT /setup/settings`)**:
   - Restricted from `@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')` to `@Roles('SUPER_ADMIN')` only, preventing centre admins from mutating global institute branding, academic year activations, or HQ configs.

---

## Changed Files Summary

| File Path | Description of Changes |
| :--- | :--- |
| `apps/api/src/staff/staff.service.ts` | Early role validation, privilege escalation defense, target role and centre protection on create/update/delete. |
| `apps/api/src/support/support.controller.ts` | Passed `req.user` to `getAllTickets` and `updateTicketStatus`. |
| `apps/api/src/support/support.service.ts` | Multi-tenant scoping for tickets based on owner centre/batch linkages; status enum validation; fail-closed authorization. |
| `apps/api/src/enquiry/enquiry.controller.ts` | Passed `req.user` to CRUD methods; added `@Get('unreconciled')` endpoint for Super Admin. |
| `apps/api/src/enquiry/enquiry.service.ts` | Public creation field whitelisting; tenant-scoped CRUD; cross-centre prevention; reconciliation reporter. |
| `apps/api/src/study-materials/study-materials.module.ts` | Exported `StudyMaterialService` for consumption by `EstudyModule`. |
| `apps/api/src/study-materials/study-materials.service.ts` | Added `centreId` persistence; server-enforced `uploaderId`; aligned tenant queries. |
| `apps/api/src/estudy/estudy.module.ts` | Imported `StudyMaterialModule`. |
| `apps/api/src/estudy/estudy.controller.ts` | Passed `req.user` to `getMaterials` and `createMaterial`. |
| `apps/api/src/estudy/estudy.service.ts` | Delegated to `StudyMaterialService` with active syllabus/year pre-validation. |
| `apps/api/src/syllabus/syllabus.controller.ts` | Added `RolesGuard`, explicit `@Roles(...)`, and actor passing on all routes. |
| `apps/api/src/syllabus/syllabus.service.ts` | Added `assertBatchAccess`; batch progress mutation checks; chapter/topic syllabus matching; student privacy checks. |
| `apps/api/src/syllabus/config.controller.ts` | Added `RolesGuard`, restricted `PUT` to `SUPER_ADMIN`, added payload whitelisting. |
| `apps/api/src/setup/setup.controller.ts` | Restricted `PUT /setup/settings` to `SUPER_ADMIN`. |
| `packages/database/prisma/schema.prisma` | Added `centreId` and `Centre` relations to `Enquiry` and `StudyMaterial`. |
| `packages/database/prisma/migrations/20261025_add_enquiry_and_studymaterial_centre/migration.sql` | Idempotent migration adding `centreId` columns and foreign key constraints. |
| `apps/api/src/common/authorization-remediation.spec.ts` | 20 dedicated unit regression tests covering Scopes A, B, and C. |

---

## Migration & Legacy Data Backfill Notes

### Migration SQL
The migration script is stored at:
`packages/database/prisma/migrations/20261025_add_enquiry_and_studymaterial_centre/migration.sql`

It uses safe, idempotent `DO $$ BEGIN ... END $$;` blocks:
- Adds `"centreId" TEXT` to `"enquiries"` table if not exists.
- Adds constraint `"enquiries_centreId_fkey"` referencing `"centres"("id") ON DELETE SET NULL ON UPDATE CASCADE`.
- Adds `"centreId" TEXT` to `"study_materials"` table if not exists.
- Adds constraint `"study_materials_centreId_fkey"` referencing `"centres"("id") ON DELETE SET NULL ON UPDATE CASCADE`.

### Recommended Backfill Query (Unambiguous Records)
Run this SQL query to reconcile legacy enquiries where the assigned staff member belongs to exactly one centre:

```sql
UPDATE enquiries e
SET "centreId" = uc."centreId"
FROM user_centres uc
WHERE e."assignedToId" = uc."userId"
  AND e."centreId" IS NULL
  AND (
    SELECT COUNT(*) 
    FROM user_centres uc2 
    WHERE uc2."userId" = e."assignedToId"
  ) = 1;
```

Ambiguous records (where `assignedToId` is null, or the staff member belongs to multiple centres) remain `centreId = null` and are isolated to `SUPER_ADMIN` until reviewed via `GET /api/enquiry/unreconciled`.

---

## Test Execution Commands & Verified Outcomes

### 1. Dedicated Authorization Remediation Regression Suite
**Command**:
```bash
pnpm --filter api test -- src/common/authorization-remediation.spec.ts
```
**Outcome**:
```text
PASS src/common/authorization-remediation.spec.ts (8.623 s)
  Authorization Remediation Regression Suite
    Scope A — Staff Privilege Escalation Remediation
      ✓ Centre admin creating SUPER_ADMIN -> HTTP 403 Forbidden (19 ms)
      ✓ Centre admin creating CENTRE_ADMIN -> HTTP 403 Forbidden
      ✓ Centre admin updating a teacher to SUPER_ADMIN -> HTTP 403 Forbidden (1 ms)
      ✓ Centre admin updating or deleting a super-admin/centre-admin account -> HTTP 403 Forbidden (1 ms)
      ✓ Centre admin operating on staff from another centre -> HTTP 403 Forbidden
      ✓ Super admin assigning an allowed role -> succeeds (64 ms)
    Scope B — Tenant Isolation: Support Tickets, Enquiries, and Study Materials
      1. Support Tickets Isolation
        ✓ Centre Admin A cannot see tickets owned by users with no verified centre link (1 ms)
        ✓ Centre Admin A updating status of ticket belonging to user in Centre B -> HTTP 403 Forbidden (1 ms)
        ✓ Super Admin can view and update tickets globally (1 ms)
      2. Enquiry Isolation & Whitelisting
        ✓ Public enquiry cannot set assignedToId, status, internal notes or privileged fields
        ✓ Centre Admin A cannot list or update Centre B enquiries (3 ms)
        ✓ Centre Admin A cannot create enquiry assigned to Centre B (1 ms)
      3. Study Materials & E-Study Isolation
        ✓ Student A cannot retrieve materials for a course/batch they are not enrolled in (1 ms)
        ✓ Centre Admin A cannot create material targeting Centre B (14 ms)
    Scope C — Syllabus Progress and Configuration Permissions
      ✓ Student calling chapter/topic batch-progress mutation -> HTTP 403 Forbidden (4 ms)
      ✓ Student querying another student progress -> HTTP 403 Forbidden (1 ms)
      ✓ Student querying progress for a batch they are not enrolled in -> HTTP 403 Forbidden
      ✓ Centre Admin A cannot read or mutate a batch belonging to Centre B (1 ms)
      ✓ Batch A combined with an unrelated chapter/topic ID is rejected with HTTP 400
      ✓ Teacher without appropriate assignment cannot mutate that batch (1 ms)

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
Time:        8.899 s
```

### 2. Full Security & Core Regression Suite
**Command**:
```bash
pnpm --filter api test
```
**Outcome**:
```text
Test Suites: 17 passed, 17 total
Tests:       333 passed, 333 total
Snapshots:   0 total
Time:        127.08 s
```

### 3. API Build Verification
**Command**:
```bash
pnpm --filter api build
```
**Outcome**:
```text
> api@0.0.1 build /Users/akshaidpillai04/Downloads/educare_lms/apps/api
> nest build
Exit code: 0
```

---

## Blocked Tests & Assumptions
- **Blocked Tests**: None. All 17 test suites and 333 unit and regression tests executed and passed cleanly.
- **Production Migrations**: In accordance with user rules, migrations were generated and committed to the repository, but were **not** executed against production databases.
- **Backfill Execution**: The SQL backfill script has been documented above for review and manual execution by operations/DBA.
