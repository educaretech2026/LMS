# EduCare LMS — Authorization Remediation Report

## 1. Executive Summary
This report documents the security fixes and multi-tenant authorization remediations implemented in the `educare_lms` repository.

The remediations address critical authorization gaps:
- **Staff Privilege Escalation**: Non-super admins (`CENTRE_ADMIN`) can no longer provision `SUPER_ADMIN` or `CENTRE_ADMIN` accounts, promote teachers, or modify/delete accounts outside their assigned centre.
- **Tenant Isolation**:
  - Support tickets are strictly scoped to the user or to centre-verified users.
  - Enquiries are assigned durable tenant ownership in Prisma (`centreId`), with public forms restricted to safe contact fields, and authenticated CRUD strictly scoped to authorized centres.
  - Study materials enforce server-side `uploaderId = req.user.id`, store `centreId`, and constrain student access to enrolled courses and batches.
- **Syllabus & Config Protection**: Batch chapter/topic progress mutations are forbidden to students (`403 Forbidden`) and validated against batch centre and syllabus hierarchy. Institute-wide setup and syllabus configuration mutations are strictly locked down to `SUPER_ADMIN`.

All changes strictly adhere to fail-closed access control principles: client-supplied roles, centre IDs, user IDs, and statuses are rejected unless validated against the authenticated actor and the database.

---

## 2. Branch Name and Working-Tree Status
- **Git Branch**: `fix/authorization-remediation`
- **Base Branch**: `main`
- **Working-Tree Status**: Clean (all changes committed under author `nonstradamoz <nonstradamoz@users.noreply.github.com>`).
- **Head Commit**: `942afc4` (`feat(security): implement authorization remediations for staff, tenants, and syllabus`).

---

## 3. Modified Files and Rationale

| File Path | Component | Rationale & Change Summary |
| :--- | :--- | :--- |
| `packages/database/prisma/schema.prisma` | Database Schema | Added `centreId String?` and `Centre?` relations to `Enquiry` and `StudyMaterial` models for durable tenant isolation. |
| `packages/database/prisma/migrations/20261025_add_enquiry_and_studymaterial_centre/migration.sql` | Migration SQL | Created idempotent PostgreSQL DDL migration to add columns and foreign key constraints without destructive data loss. |
| `apps/api/src/staff/staff.service.ts` | Staff Service | Enforced role check prior to database lookups; restricted `CENTRE_ADMIN` to creating `TEACHER` accounts only; prevented editing/deleting privileged accounts or cross-centre staff. |
| `apps/api/src/support/support.controller.ts` | Support Controller | Passed authenticated actor `req.user` to `getAllTickets` and `updateTicketStatus`. |
| `apps/api/src/support/support.service.ts` | Support Service | Implemented multi-tenant ticket scoping based on owner centre/enrolment linkages; validated status enum; failed closed for unassociated users. |
| `apps/api/src/enquiry/enquiry.controller.ts` | Enquiry Controller | Passed `req.user` to CRUD routes; added `@Get('unreconciled')` endpoint for Super Admin reconciliation. |
| `apps/api/src/enquiry/enquiry.service.ts` | Enquiry Service | Whitelisted public submission fields (stripped `status`, `assignedToId`, `notes`); scoped authenticated CRUD to authorized centres; added legacy reconciliation query. |
| `apps/api/src/study-materials/study-materials.module.ts` | Study Material Module | Exported `StudyMaterialService` for cross-module consumption by `EstudyModule`. |
| `apps/api/src/study-materials/study-materials.service.ts` | Study Material Service | Enforced server-derived `uploaderId = req.user.id`; added `centreId` persistence; validated target track and teacher assignments. |
| `apps/api/src/estudy/estudy.module.ts` | E-Study Module | Imported `StudyMaterialModule` to eliminate duplicate/unsecured material queries. |
| `apps/api/src/estudy/estudy.controller.ts` | E-Study Controller | Injected `req.user` into `getMaterials` and `createMaterial`. |
| `apps/api/src/estudy/estudy.service.ts` | E-Study Service | Delegated to `StudyMaterialService` with pre-validation of active academic year and syllabus entities. |
| `apps/api/src/syllabus/syllabus.controller.ts` | Syllabus Controller | Added `RolesGuard`, explicit `@Roles(...)` metadata on all endpoints, and forwarded `req.user` to service methods. |
| `apps/api/src/syllabus/syllabus.service.ts` | Syllabus Service | Implemented `assertBatchAccess`; restricted batch progress mutations to staff; validated chapter/topic against batch syllabus; enforced student progress privacy. |
| `apps/api/src/syllabus/config.controller.ts` | Config Controller | Added `RolesGuard`, restricted `PUT` to `@Roles('SUPER_ADMIN')`, and whitelisted update payload fields. |
| `apps/api/src/setup/setup.controller.ts` | Setup Controller | Restricted `PUT /setup/settings` from `SUPER_ADMIN, CENTRE_ADMIN` to `@Roles('SUPER_ADMIN')` only. |
| `apps/api/src/common/authorization-remediation.spec.ts` | Test Suite | Added 20 comprehensive unit regression tests covering Scopes A, B, and C. |

---

## 4. Authorization Policies Before and After Implementation

### A. Staff Management (`/api/staff`)
- **Before**: A Centre Admin could submit any `role` in the request body (including `SUPER_ADMIN` or `CENTRE_ADMIN`). A Centre Admin could edit, promote, or delete any staff member by ID regardless of centre assignment.
- **After**:
  - Non-super admins (`CENTRE_ADMIN`) can **only** provision `TEACHER` accounts. Attempts to assign any other role immediately fail with `403 Forbidden`.
  - Non-super admins cannot update or delete accounts holding `SUPER_ADMIN` or `CENTRE_ADMIN` roles (`403 Forbidden`).
  - Target staff must belong to one of the caller's authorized centres (`assertCentreAccess`). Cross-centre updates or deletions are rejected with `403 Forbidden`.

### B. Support Tickets (`/api/support/tickets`)
- **Before**: `getAllTickets()` returned all support tickets in the database without checking the caller. `updateTicketStatus(id, status)` executed a blind update by ticket ID without owner verification.
- **After**:
  - `GET /support/tickets/me` remains restricted to the authenticated user's own tickets.
  - `GET /support/tickets` allows `SUPER_ADMIN` to see all tickets, while `CENTRE_ADMIN` only sees tickets whose owning user is linked to their authorized centres (`userCentres` for staff, or active batch enrollments for students).
  - `PUT /support/tickets/:id/status` loads the ticket with owner links, validates the status enum, and verifies that the owner belongs to the caller's centre before updating. Fails closed with `403 Forbidden` if unverified.

### C. Enquiries & CRM (`/api/enquiry`)
- **Before**: `Enquiry` model had no `centreId`. Public `POST /api/enquiry/public` spread `...data` directly into Prisma, allowing attackers to inject `status: QUALIFIED`, `assignedToId`, and arbitrary internal `notes`. Authenticated endpoints returned all enquiries globally.
- **After**:
  - `Enquiry` has a persistent `centreId` with a foreign key to `Centre`.
  - Public submission strictly whitelists contact fields; `status` is hardcoded to `NEW`, privileged fields are discarded, and `centreId` is validated against active centres.
  - Authenticated `create`, `getAll`, `getSummary`, and `update` are strictly tenant-scoped to the user's `userCentres`. Cross-centre updates are rejected with `403 Forbidden`.
  - Unreconciled legacy records (`centreId = null`) remain visible exclusively to `SUPER_ADMIN` until resolved.

### D. Study Materials & E-Study (`/api/study-materials` & `/api/estudy`)
- **Before**: `/api/estudy` returned all study materials via `prisma.studyMaterial.findMany()` with no user or tenant filtering. `uploaderId` could be passed from the client body.
- **After**:
  - `StudyMaterial` includes a persistent `centreId`.
  - `uploaderId` is unconditionally bound to `req.user.id`.
  - `/api/estudy` routes delegate to `StudyMaterialService`, enforcing that students only access materials matching their enrolled courses/batches, while teachers/admins are constrained to their authorized centres and teaching assignments.

### E. Syllabus Batch Progress & Student Progress (`/api/syllabus`)
- **Before**: `SyllabusController` had no `RolesGuard` or `@Roles` decorators. Students could call `POST /syllabus/progress/chapter` and `POST /syllabus/progress/topic` to overwrite shared batch progress. Any user could view any student's progress via `/syllabus/student-progress/:batchId/:studentId`. Mismatched batch and chapter/topic IDs were accepted without validation.
- **After**:
  - `RolesGuard` applied. Batch progress mutations are restricted to `SUPER_ADMIN`, `CENTRE_ADMIN`, and assigned `TEACHER` accounts. Students receive `403 Forbidden`.
  - Batch centre authorization is checked via `assertBatchAccess`.
  - `chapterId` and `topicId` are validated against the batch's board and standard syllabus (`400 Bad Request` on mismatch).
  - Students can only view their own student progress and only for batches they are actively enrolled in (`403 Forbidden` otherwise).
  - Learner progress events verify active enrollment and syllabus membership.

### F. Global Configuration (`/setup/settings` & `/syllabus-config`)
- **Before**: `PUT /setup/settings` was accessible to `CENTRE_ADMIN`. `PUT /syllabus-config` had no `RolesGuard` and wrote arbitrary request JSON directly to the database.
- **After**:
  - `PUT /setup/settings` is strictly restricted to `@Roles('SUPER_ADMIN')`.
  - `PUT /syllabus-config` is strictly restricted to `@Roles('SUPER_ADMIN')` with `RolesGuard` and field whitelisting.

---

## 5. Prisma Schema Changes and Migration/Backfill Instructions

### Schema Diff
Added relations to `Centre`, `Enquiry`, and `StudyMaterial` in `packages/database/prisma/schema.prisma`:
```prisma
model Centre {
  ...
  enquiries          Enquiry[]
  studyMaterials     StudyMaterial[]
}

model Enquiry {
  ...
  centreId     String?
  centre       Centre? @relation(fields: [centreId], references: [id], onDelete: SetNull)
}

model StudyMaterial {
  ...
  centreId       String?
  centre         Centre? @relation(fields: [centreId], references: [id], onDelete: SetNull)
}
```

### Generated Migration
File: `packages/database/prisma/migrations/20261025_add_enquiry_and_studymaterial_centre/migration.sql`

```sql
-- AlterTable Enquiry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'enquiries'
        AND column_name = 'centreId'
    ) THEN
        ALTER TABLE "enquiries" ADD COLUMN "centreId" TEXT;
    END IF;
END $$;

-- AddForeignKey Enquiry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'enquiries_centreId_fkey'
    ) THEN
        ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable StudyMaterial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'study_materials'
        AND column_name = 'centreId'
    ) THEN
        ALTER TABLE "study_materials" ADD COLUMN "centreId" TEXT;
    END IF;
END $$;

-- AddForeignKey StudyMaterial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'study_materials_centreId_fkey'
    ) THEN
        ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
```

### Legacy Data Backfill Strategy
1. **Unambiguous Backfill (Automated Query)**:
   For enquiries where the assigned staff member belongs to exactly one centre:
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
2. **Ambiguous Records (Manual Reconciliation Path)**:
   Enquiries with `assignedToId = null` or assigned staff belonging to multiple centres remain `centreId = null`. These are isolated to `SUPER_ADMIN` and can be inspected via:
   `GET /api/enquiry/unreconciled`

---

## 6. Regression Tests Added

File: `apps/api/src/common/authorization-remediation.spec.ts` (20 tests):

### Scope A — Staff Privilege Escalation
1. `Centre admin creating SUPER_ADMIN -> HTTP 403 Forbidden`
2. `Centre admin creating CENTRE_ADMIN -> HTTP 403 Forbidden`
3. `Centre admin updating a teacher to SUPER_ADMIN -> HTTP 403 Forbidden`
4. `Centre admin updating or deleting a super-admin/centre-admin account -> HTTP 403 Forbidden`
5. `Centre admin operating on staff from another centre -> HTTP 403 Forbidden`
6. `Super admin assigning an allowed role -> succeeds`

### Scope B — Tenant Isolation
7. `Centre Admin A cannot see tickets owned by users with no verified centre link`
8. `Centre Admin A updating status of ticket belonging to user in Centre B -> HTTP 403 Forbidden`
9. `Super Admin can view and update tickets globally`
10. `Public enquiry cannot set assignedToId, status, internal notes or privileged fields`
11. `Centre Admin A cannot list or update Centre B enquiries`
12. `Centre Admin A cannot create enquiry assigned to Centre B`
13. `Student A cannot retrieve materials for a course/batch they are not enrolled in`
14. `Centre Admin A cannot create material targeting Centre B`

### Scope C — Syllabus Progress and Configuration
15. `Student calling chapter/topic batch-progress mutation -> HTTP 403 Forbidden`
16. `Student querying another student progress -> HTTP 403 Forbidden`
17. `Student querying progress for a batch they are not enrolled in -> HTTP 403 Forbidden`
18. `Centre Admin A cannot read or mutate a batch belonging to Centre B`
19. `Batch A combined with an unrelated chapter/topic ID is rejected with HTTP 400`
20. `Teacher without appropriate assignment cannot mutate that batch`

---

## 7. Exact Test and Validation Commands & Pass/Fail Results

### 1. Dedicated Authorization Remediation Suite
- **Command**: `pnpm --filter api test -- src/common/authorization-remediation.spec.ts`
- **Result**: **PASS** (1 test suite, 20/20 tests passed, duration: 8.899 s)

### 2. Full Application Security & Regression Suite
- **Command**: `pnpm --filter api test`
- **Result**: **PASS** (17 test suites, 333/333 tests passed, duration: 127.08 s)
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
  - `src/common/security-regression.spec.ts`: PASS (298/298 tests passed)
  - `src/common/authorization-remediation.spec.ts`: PASS (20/20 tests passed)

### 3. API Build Verification
- **Command**: `pnpm --filter api build`
- **Result**: **PASS** (NestJS production build succeeded with exit code 0)

---

## 8. Blocked Tests & Dependencies
- **Blocked Tests**: None. All existing and newly added test suites executed completely without skipped or blocked assertions.
- **Environment**: Local PostgreSQL and Redis instances were used for local validation. No remote or production systems were connected.

---

## 9. Remaining Security Considerations & Assumptions
1. **Public Enquiry Rate Limiting**: The public endpoint `/api/enquiry/public` now validates and strips privileged fields. In production, an IP-based rate limiter (such as `@nestjs/throttler` or Cloudflare WAF rate limiting) should be configured to prevent automated lead spamming.
2. **Legacy Study Materials with `centreId = null`**: Legacy study materials created prior to this remediation have `centreId = null`. If they have no target track, they are treated as global HQ content uploaded by `SUPER_ADMIN`. An operational audit of existing material rows is recommended to backfill centre IDs where materials were intended for single centres.
3. **Multi-Centre Student Disambiguation**: When an enrolled student submits a support ticket, the ticket is visible to Centre Admins of any centre where the student is actively enrolled. If tickets require explicit centre routing upon submission, a `centreId` selector can be added to the student support form.

---

## 10. Steps Required for Code Review and Eventual Deployment

1. **Code Review**:
   - Inspect the commit diff on branch `fix/authorization-remediation`.
   - Verify that all role checks and tenant isolation utilities use fail-closed semantics.
2. **Database Migration Execution (Staging/Production)**:
   - Run the migration in the target environment:
     ```bash
     pnpm --filter @educare/database prisma migrate deploy
     ```
   - Verify column creation: `SELECT column_name FROM information_schema.columns WHERE table_name = 'enquiries' AND column_name = 'centreId';`
3. **Legacy Data Backfill Execution**:
   - Execute the unambiguous backfill SQL query documented in Section 5.
   - Run `SELECT COUNT(*) FROM enquiries WHERE "centreId" IS NULL;` to check remaining unreconciled leads.
   - Log in as Super Admin and inspect `/api/enquiry/unreconciled` to resolve any ambiguous records.
4. **Deploy Application Services**:
   - Build and deploy the API and Web services.
   - Verify that health checks and end-to-end smoke tests pass.
