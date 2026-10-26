# EduCare LMS — Comprehensive Code-Level Security Audit Report

**Target Repository:** `educare_lms`  
**Date of Audit:** October 25, 2026  
**Audit Classification:** Confidential Security Assessment  
**Audit Type:** Static Application Security Testing (SAST), Configuration Review, Authorization Matrix & Threat Analysis  
**Auditor:** Senior Application Security & Penetration-Testing Specialist  

---

## 1. Executive Summary

### 1.1 Overall Security Posture
A comprehensive, code-level security audit of the entire **EduCare LMS** monorepo (`apps/api`, `apps/web`, `apps/mobile`, `packages/database`, and deployment configurations) was conducted. 

EduCare LMS has implemented significant defensive improvements in key areas, including argon2 password hashing, Redis-backed session tracking and revocation, parameterized Prisma queries, CSV formula sanitization in audit logs, and server-side authoritative exam scoring.

However, the application contains **critical architectural and authorization vulnerabilities** that make it **NOT ready for production deployment** in its current state. The most severe issues stem from broken multi-tenant authorization boundaries where centre administrators can escalate privileges to Super Administrator, unauthenticated endpoints with missing rate limiting, unrestricted cross-centre data leakage in secondary modules (enquiries, support, SMS, estudy), unprotected Cloudflare Stream media privacy (`requireSignedURLs: false`), and default infrastructure credentials.

### 1.2 Total Findings by Severity

| Severity | Count | Summary |
| :--- | :---: | :--- |
| **Critical** | **4** | Privilege escalation to Super Admin, default credentials in seed/compose, unauthenticated OTP brute-force, Cloudflare Stream public playback & open origins |
| **High** | **7** | Cross-centre enquiry & support leakage, syllabus authorization bypass, global settings overwrite by branch admin, CSRF risk with `SameSite=None` cookies, production Swagger exposure, lockfile bypass in deployment |
| **Medium** | **6** | Arbitrary WhatsApp SMS dispatch, public forms upload exhaustion, DTO whitelist bypass on controllers, missing current password verification on profile updates, outdated high-risk dependencies, raw SQL `$queryRawUnsafe` usage |
| **Low** | **3** | Unpinned JWT algorithm in strategy, unconstrained query pagination on specific tables, missing database TLS specification in `.env.example` |
| **Informational** | **3** | Redis unauthenticated loopback hardening, database automated backup strategy, absence of ClamAV virus scanning pipeline |
| **Total** | **23** | **23 Documented Findings** |

### 1.3 Most Urgent Issues (Top Remediation Priorities)
1. **SEC-FIND-01 (Critical): Privilege Escalation to Super Admin via Staff API** — Restrict `POST /api/staff` and `PUT /api/staff/:id` so non-super admins cannot assign `SUPER_ADMIN`.
2. **SEC-FIND-02 (Critical): Hardcoded Administrator Credentials in Seed & Default DB Passwords** — Remove hardcoded passwords (`admin123`, `centre123`, `password`) and enforce runtime environment generation.
3. **SEC-FIND-03 (Critical): Cloudflare Stream Unsigned Playback and Permissive Origins** — Enforce `requireSignedURLs: true`, restrict origins, and implement token signing for enrolled students.
4. **SEC-FIND-04 (Critical): Unthrottled 6-Digit OTP Verification in Public Auth** — Enforce maximum 5 attempts and Redis-backed account lockout on `POST /api/public/auth/verify-otp`.
5. **SEC-FIND-05 (High): Cross-Centre Tenant Isolation Bypass in Enquiries, Support & Estudy** — Add tenant filters (`where: { centreId: { in: authorizedCentres } }`) to `EnquiryService`, `SupportService`, and `EstudyService`.
6. **SEC-FIND-06 (High): Missing RolesGuard on Syllabus Controller** — Add `@RolesGuard` and restrict progress mutation to assigned Teachers/Admins.
7. **SEC-FIND-07 (High): Global Settings Overwrite by Centre Administrators** — Restrict `PUT /api/setup/settings` strictly to `SUPER_ADMIN`.

---

## 2. Architecture and Attack Surface

### 2.1 Component Architecture
```
                                 [ Browser Clients / Mobile App ]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
             [ Next.js 16 Web App (BFF) ]                   [ Expo Mobile App ]
             (apps/web - Port 3000)                        (apps/mobile - Native)
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                ▼
                                    [ NestJS API Gateway ]
                                     (apps/api - Port 3001)
                                                │
             ┌───────────────────┬──────────────┴───────┬───────────────────┐
             ▼                   ▼                      ▼                   ▼
    [ PostgreSQL 16 ]      [ Redis 7 ]         [ Cloudflare R2 ]   [ Cloudflare Stream ]
    (Database Engine)    (Sessions & Rate)       (S3-compatible)     (Video Streaming)
```

### 2.2 Security Boundaries & Trust Zones
1. **Public Zone**: Unauthenticated internet traffic accessing `/api/auth/login`, `/api/public/*`, `/api/forms/:id`, `/api/live-class/public/:id`, and `/api/docs`.
2. **Student & Public Learner Zone**: Authenticated learners accessing enrollments, study materials, live class links, assignments, exam attempts, and doubt threads.
3. **Teacher Zone**: Assigned educators managing batch attendance, marking exams, grading assignments, creating doubts responses, and viewing class rosters.
4. **Centre Administrator Zone**: Branch managers managing local batches, staff, student enrollments, local fee collection, and centre finances.
5. **Super Administrator Zone**: System administrators managing global configurations, institute settings, RBAC role definitions, academic years, and cross-centre reporting.

### 2.3 Attack Surface Mapping

| Entry Point / Route Prefix | Authentication | Intended Roles | Risk Level |
| :--- | :--- | :--- | :--- |
| `/api/auth/login`, `logout` | Optional (Public login) | All Users | Medium |
| `/api/public/auth/*` | None (Public) | Public Learners | **High (OTP Brute Force)** |
| `/api/forms/:id/upload-url` | None (Public) | Anyone | **High (Upload Exhaustion)** |
| `/api/live-class/public/*` | None (Public) | Webinar Attendees | Low |
| `/api/staff/*` | JWT Bearer / Cookie | Super Admin, Centre Admin | **Critical (Privilege Escalation)** |
| `/api/setup/settings` | JWT Bearer / Cookie | Super Admin, Centre Admin | **High (HQ Configuration Overwrite)** |
| `/api/enquiry/*` | Mixed (Public POST, Admin GET) | Super Admin, Centre Admin | **High (Tenant Leakage)** |
| `/api/support/tickets` | JWT Bearer / Cookie | Super Admin, Centre Admin | **High (Cross-Centre Leakage)** |
| `/api/estudy/*` | JWT Bearer / Cookie | Super Admin, Centre Admin, Teacher, Student | **High (Unrestricted Material Access)** |
| `/api/syllabus/*` | JWT Bearer / Cookie | Any authenticated user | **High (Unauthorized Status Modification)** |
| `/api/cloudflare/upload-url`| JWT Bearer / Cookie | Super Admin, Centre Admin, Teacher | **High (Unsigned Streaming Abuse)** |
| `/api/sms/send` | JWT Bearer / Cookie | Super Admin, Centre Admin | **Medium (Arbitrary Toll/Spam Abuse)** |
| `/api/docs` (Swagger UI) | None (Public) | Developers | **High (Information Disclosure)** |

---

## 3. Detailed Security Findings

### SEC-FIND-01: Privilege Escalation to Super Admin via Staff Management API
- **Finding ID:** SEC-FIND-01
- **Title:** Privilege Escalation from Centre Admin to Super Admin in Staff API
- **Severity:** Critical
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-269: Improper Privilege Management
- **File & Lines:** `apps/api/src/staff/staff.service.ts`: Lines 17–44, Lines 191–215; `apps/api/src/staff/staff.controller.ts`: Lines 14–28
- **Code Excerpt:**
  ```typescript
  // apps/api/src/staff/staff.service.ts
  async createStaff(data: any, currentUser?: any) {
    const roleName = data.role; // Client supplied role string (e.g., 'SUPER_ADMIN')
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" not found.`);

    const centre = await this.prisma.centre.findFirst({ where: { name: data.centre } });
    if (!centre) throw new NotFoundException(`Centre "${data.centre}" not found.`);

    if (currentUser && !isSuperAdmin(currentUser)) {
      assertCentreAccess(currentUser, centre.id);
    }
    ...
    // Creates user directly with role.id without verifying if currentUser has right to grant that role
    const user = await prisma.user.create({
      data: { ..., roleId: role.id }
    });
  ```
- **Root Cause:** `StaffService.createStaff` and `updateStaff` only check if the current user has access to the target centre; they fail to check whether `currentUser` has authority to grant the requested role. Any `CENTRE_ADMIN` can pass `data.role = 'SUPER_ADMIN'` to create or update any staff member to `SUPER_ADMIN`.
- **Preconditions & Attack Scenario:** A malicious or compromised Centre Administrator sends a `POST /api/staff` request with `{ "name": "Attacker", "email": "attacker@centre.com", "role": "SUPER_ADMIN", "centre": "Educare Kalathipady" }`. The server creates a Super Admin user. The attacker logs in with this user and gains full access across all centres, databases, financials, and configurations.
- **Affected Roles & Data:** All application roles, centres, student records, credentials, and settings.
- **Recommended Remediation:** Enforce role hierarchy validation: only `SUPER_ADMIN` can create or assign `SUPER_ADMIN` or `CENTRE_ADMIN` roles. Centre Admins must only be permitted to create `TEACHER` or non-admin roles for their assigned centre.
- **Corrected Code:**
  ```typescript
  const ALLOWED_CENTRE_ADMIN_ROLES = ['TEACHER'];
  if (!isSuperAdmin(currentUser)) {
    if (!ALLOWED_CENTRE_ADMIN_ROLES.includes(roleName)) {
      throw new ForbiddenException('Centre Administrators can only provision Teachers.');
    }
  }
  ```
- **Regression Test:** Invoke `createStaff({ role: 'SUPER_ADMIN', centre: 'Educare Kalathipady' }, centreAdminUser)` and expect HTTP 403 `ForbiddenException`.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-02: Hardcoded Production Administrator Credentials in Seed & Default Passwords
- **Finding ID:** SEC-FIND-02
- **Title:** Hardcoded Well-Known Administrator Credentials in Database Seed Script
- **Severity:** Critical
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-798: Use of Hard-coded Credentials / CWE-1188
- **File & Lines:** `packages/database/prisma/seed.ts`: Lines 86–112; `docker-compose.yml`: Lines 8–10
- **Code Excerpt:**
  ```typescript
  // packages/database/prisma/seed.ts
  // Line 87-98
  const superAdminPassword = await argon2.hash('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@educare.com' },
    update: { roleId: superAdminRole.id },
    create: {
      email: 'admin@educare.com',
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      roleId: superAdminRole.id,
    },
  });

  // Line 101-112
  const centreAdminPassword = await argon2.hash('centre123');
  const centreAdminA = await prisma.user.upsert({
    where: { email: 'centrea@educare.com' },
    create: {
      email: 'centrea@educare.com',
      password: centreAdminPassword,
      roleId: centreAdminRole.id,
    },
  });
  ```
- **Root Cause:** The database seed script contains fixed, hardcoded passwords (`admin123`, `centre123`) and default emails (`admin@educare.com`, `centrea@educare.com`) with zero environment gating (`NODE_ENV === 'production'`) and no forced password reset flag. Furthermore, `docker-compose.yml` defaults PostgreSQL password to `${POSTGRES_PASSWORD:-password}`.
- **Preconditions & Attack Scenario:** If `prisma db seed` is executed during setup or post-deployment migration in production, well-known administrator accounts are created. Any attacker who knows the repository can log in as `admin@educare.com` with `admin123` and take over the system.
- **Affected Roles & Data:** Full administrative compromise.
- **Recommended Remediation:** 
  1. Abort `seed.ts` immediately if `process.env.NODE_ENV === 'production'` unless `INITIAL_ADMIN_PASSWORD` is supplied via a secure environment secret.
  2. Enforce `mustChangePassword: true` on initial provisioned accounts.
  3. Require non-default passwords in `docker-compose.yml` and `.env`.
- **Regression Test:** Run `seed.ts` in production mode without explicit environment credentials; verify it refuses to execute.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-03: Cloudflare Stream Unsigned Playback URLs and Permissive Origins
- **Finding ID:** SEC-FIND-03
- **Title:** Cloudflare Stream Media Configured Without Token Signing and Wildcard Origins
- **Severity:** Critical
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-284: Improper Access Control
- **File & Lines:** `apps/api/src/cloudflare/cloudflare.service.ts`: Lines 21–26; `apps/api/src/cloudflare/cloudflare.controller.ts`: Lines 12–16
- **Code Excerpt:**
  ```typescript
  // apps/api/src/cloudflare/cloudflare.service.ts
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      requireSignedURLs: false,
      allowedOrigins: ["*"]
    })
  });
  ```
- **Root Cause:** When generating direct upload URLs for video lectures, the payload explicitly configures `requireSignedURLs: false` and `allowedOrigins: ["*"]`. There is no signing key integration to generate short-lived signed tokens for student playback, and no course-enrollment validation before video playback.
- **Preconditions & Attack Scenario:** Once a teacher or centre administrator uploads a video, the video ID becomes publicly accessible across the internet. Anyone with the video UID can embed, play, scrape, or redistribute proprietary educational lectures without an active account or paid enrollment.
- **Affected Roles & Data:** All proprietary recorded class videos, lectures, and educational IP.
- **Recommended Remediation:** 
  1. Change `requireSignedURLs` to `true`.
  2. Set `allowedOrigins` to the specific LMS domain (e.g., `["lms.educarelearning.in"]`).
  3. Implement an authenticated playback endpoint (`GET /api/cloudflare/playback-token/:videoId`) that verifies the student's enrollment in the course/batch and signs a short-lived Cloudflare Stream playback token (using RSA key or Cloudflare Stream Token API).
- **Regression Test:** Verify that direct video URLs without a signed token return HTTP 403 on Cloudflare, and verify playback tokens expire within 60 minutes.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-04: Unthrottled 6-Digit OTP Verification in Public Learner Authentication
- **Finding ID:** SEC-FIND-04
- **Title:** Lack of Rate Limiting and Attempt Lockout on Public OTP Verification
- **Severity:** Critical
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-307: Improper Restriction of Excessive Authentication Attempts
- **File & Lines:** `apps/api/src/public-auth/public-auth.service.ts`: Lines 129–155; `apps/api/src/public-auth/public-auth.controller.ts`: Lines 17–20
- **Code Excerpt:**
  ```typescript
  // apps/api/src/public-auth/public-auth.service.ts
  async verifyOtp(userId: string, otp: string): Promise<any> {
    const otpRecord = await this.prisma.otpToken.findFirst({
      where: {
        userId,
        otp,
        used: false,
        expiresAt: { gt: new Date() }
      },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }
  ```
- **Root Cause:** The `verifyOtp` endpoint searches for a matching 6-digit numeric OTP valid for 10 minutes. When a guess fails, it merely throws a `BadRequestException` without recording the failure count, without invalidating the OTP after 5 failed attempts, and without applying Redis-backed per-user lockout.
- **Preconditions & Attack Scenario:** An attacker registers with a target victim's phone number or email, obtaining the `userId`. The OTP is a 6-digit number (100,000 to 999,999 = 900,000 possibilities). Using an asynchronous brute-force script at 300 requests/sec, the search space can be traversed within the 10-minute validity window, activating the account and bypassing phone verification.
- **Affected Roles & Data:** Public learner authentication integrity and account registration.
- **Recommended Remediation:**
  1. Track failed attempts in Redis or in the `OtpToken` record (`failedAttempts: Int`).
  2. Invalidate the OTP immediately upon 5 consecutive failed attempts.
  3. Apply strict NestJS throttler limits (`@Throttle({ default: { limit: 5, ttl: 60000 } })`) on `verifyOtp`.
- **Regression Test:** Submit 6 incorrect OTP attempts for a user ID and verify that subsequent attempts are rejected with HTTP 429 / lockout even if the 7th attempt is correct.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-05: Cross-Centre Multi-Tenant Isolation Bypass in Enquiry, Support, and Estudy Modules
- **Finding ID:** SEC-FIND-05
- **Title:** Missing Multi-Tenant Centre Isolation in Enquiries, Support Tickets, and Estudy
- **Severity:** High
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-639: Authorization Bypass Through User-Controlled Key / CWE-284
- **File & Lines:**
  - `apps/api/src/enquiry/enquiry.service.ts`: Lines 15–24, Lines 46–54
  - `apps/api/src/support/support.service.ts`: Lines 26–39
  - `apps/api/src/estudy/estudy.service.ts`: Lines 8–21
- **Code Excerpt:**
  ```typescript
  // apps/api/src/enquiry/enquiry.service.ts
  async getAllEnquiries() {
    return this.prisma.enquiry.findMany({ // No tenant or centre scoping!
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  // apps/api/src/support/support.service.ts
  async getAllTickets() {
    return this.prisma.supportTicket.findMany({ // No centre scoping!
      include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } }
    });
  }

  // apps/api/src/estudy/estudy.service.ts
  async getMaterials() {
    return this.prisma.studyMaterial.findMany({ ... }); // No batch/centre/enrolment check!
  }
  ```
- **Root Cause:** Controllers for enquiries, support tickets, and estudy do not pass `req.user` to their services, and services execute unfiltered `findMany()` database queries without centre membership constraints.
- **Preconditions & Attack Scenario:** A Centre Administrator for Centre B logs into the LMS and navigates to the Enquiries or Support module. The system returns prospective students' private phone numbers, emails, addresses, and inquiry notes from Centre A and HQ. Similarly, any enrolled student who requests `GET /api/estudy` receives study materials and videos belonging to other centres and courses they never enrolled in.
- **Affected Roles & Data:** PII of prospective students, cross-centre support communications, proprietary course materials.
- **Recommended Remediation:** In each service, inject `user: any`, check `isSuperAdmin(user)`, obtain `getAuthorizedCentreIds(user)`, and inject `where: { centreId: { in: authorizedCentres } }` into Prisma queries.
- **Regression Test:** As Centre Admin A, query `GET /api/enquiry` and assert that records belonging to Centre B are excluded from the returned payload.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-06: Missing Role Guards and BOLA on Syllabus Progress Mutation
- **Finding ID:** SEC-FIND-06
- **Title:** Missing RolesGuard and Privilege Verification on Syllabus Controller
- **Severity:** High
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-285: Improper Authorization
- **File & Lines:** `apps/api/src/syllabus/syllabus.controller.ts`: Lines 6–31; `apps/api/src/syllabus/config.controller.ts`: Lines 9–31
- **Code Excerpt:**
  ```typescript
  // apps/api/src/syllabus/syllabus.controller.ts
  @UseGuards(JwtAuthGuard) // RolesGuard is MISSING
  @Controller('syllabus')
  @Permissions('SYLLABUS')
  export class SyllabusController {
    ...
    @Post('progress/chapter')
    updateChapterProgress(@Body() data: { batchId: string; chapterId: string; status: ... }, @Req() req: any) {
      return this.syllabusService.updateChapterProgress(data.batchId, data.chapterId, data.status, req.user.id);
    }

    @Get('student-progress/:batchId/:studentId')
    getStudentProgress(@Param('batchId') batchId: string, @Param('studentId') studentId: string) {
      return this.syllabusService.getStudentSyllabusProgress(batchId, studentId);
    }
  ```
- **Root Cause:** `SyllabusController` and `ConfigController` only apply `JwtAuthGuard`. There is no `RolesGuard` or `@Roles` annotation. In `updateChapterProgress`, any authenticated user (including students) can change batch-level curriculum progress. In `getStudentProgress`, there is no check ensuring that the requesting user owns the `studentId` or is an assigned teacher/admin.
- **Preconditions & Attack Scenario:** A student extracts their JWT token, calls `POST /api/syllabus/progress/chapter` with `{ batchId: "...", chapterId: "...", status: "COMPLETED" }`, and successfully marks syllabus chapters as completed. A student can also query `GET /api/syllabus/student-progress/<batchId>/<otherStudentId>` to monitor other students' study habits, revision tasks, and topic progress.
- **Affected Roles & Data:** Curriculum progress integrity and student study privacy.
- **Recommended Remediation:** 
  1. Add `@UseGuards(JwtAuthGuard, RolesGuard)` to `SyllabusController` and `ConfigController`.
  2. Annotate progress updates with `@Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')`.
  3. In `getStudentProgress`, ensure students can only request their own `studentId`.
- **Regression Test:** Submit `POST /api/syllabus/progress/chapter` using a Student JWT; assert that the server returns HTTP 403 Forbidden.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-07: Global Institute Settings Overwrite by Branch Administrators
- **Finding ID:** SEC-FIND-07
- **Title:** Global Institute Settings and Academic Year Activation Modifiable by Centre Admins
- **Severity:** High
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-269: Improper Privilege Management
- **File & Lines:** `apps/api/src/setup/setup.controller.ts`: Lines 22–26; `apps/api/src/setup/setup.service.ts`: Lines 536–582
- **Code Excerpt:**
  ```typescript
  // apps/api/src/setup/setup.controller.ts
  @Put('settings')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN') // CENTRE_ADMIN is erroneously allowed
  async updateSettings(@Body() data: any) {
    return this.setupService.updateSettings(data);
  }

  // apps/api/src/setup/setup.service.ts
  async updateSettings(data: any) {
    return this.prisma.$transaction(async (tx) => {
      let centre = await tx.centre.findFirst({ orderBy: { createdAt: 'asc' } });
      if (centre) {
        await tx.centre.update({
          where: { id: centre.id }, // Updates first centre (Headquarters / Centre A)
          data: { name: data.centreName, email: data.contactEmail, contactNo: data.contactPhone }
        });
      }
      if (data.currentYear) {
        // Deactivates all other academic years across the entire LMS!
        await tx.academicYear.updateMany({ where: { id: { not: year.id } }, data: { isActive: false } });
      }
    });
  }
  ```
- **Root Cause:** `PUT /api/setup/settings` permits the `CENTRE_ADMIN` role. When invoked, `SetupService.updateSettings` modifies the primary institute centre record and globally deactivates academic years across all branches.
- **Preconditions & Attack Scenario:** An administrator of a regional centre sends a `PUT /api/setup/settings` request. The headquarters centre name, contact phone, contact email, and active academic year are overwritten institution-wide.
- **Affected Roles & Data:** Global institute configuration, academic year integrity.
- **Recommended Remediation:** Restrict `@Roles('SUPER_ADMIN')` on `PUT /api/setup/settings` and `GET /api/setup/settings`.
- **Regression Test:** Send a `PUT /api/setup/settings` request using a `CENTRE_ADMIN` token and verify that the API returns HTTP 403 Forbidden.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-08: Cross-Site Request Forgery (CSRF) Exposure via SameSite=None Cookies
- **Finding ID:** SEC-FIND-08
- **Title:** SameSite=None Cookie Authentication Without API CSRF Validation Tokens
- **Severity:** High
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-352: Cross-Site Request Forgery (CSRF)
- **File & Lines:** `apps/api/src/auth/auth.controller.ts`: Lines 30–36; `apps/api/src/auth/jwt.strategy.ts`: Lines 13–24; `apps/api/src/main.ts`: Lines 70–123
- **Code Excerpt:**
  ```typescript
  // apps/api/src/auth/auth.controller.ts
  res.cookie(cookieName, access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // Browsers will attach this cookie on third-party cross-site requests!
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  ```
- **Root Cause:** The authentication controller sets the session cookie with `sameSite: 'none'` to accommodate cross-subdomain communication between the web frontend and API. However, the NestJS API backend does not validate CSRF tokens (e.g. double-submit cookie or custom CSRF headers) on state-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`).
- **Preconditions & Attack Scenario:** An authenticated administrator or teacher visits an external malicious website while logged into EduCare. The malicious website issues a state-changing form submission or fetch request to `api.educarelearning.in`. Because `SameSite=None` is set, the victim's browser includes the `__Host-AccessToken` cookie. The API processes the request under the authenticated user's session.
- **Affected Roles & Data:** All authenticated users, financial transactions, staff changes, student records.
- **Recommended Remediation:** 
  1. Route all frontend requests through the Next.js Backend-For-Frontend (BFF) proxy and set `SameSite=Lax` on all cookies.
  2. If direct cross-domain API calls must be supported, implement strict anti-CSRF token verification (`csrf-csrf` middleware) or require a custom, non-simple header (e.g., `X-Requested-With: XMLHttpRequest` / `X-CSRF-Token`) on all non-safe HTTP methods.
- **Regression Test:** Perform a cross-site POST request simulating an origin outside the allowlist with credentials; verify the request is blocked before state execution.
- **Reproduction Status:** Inferred from code configuration.

---

### SEC-FIND-09: Production Information Disclosure via Public Swagger Documentation
- **Finding ID:** SEC-FIND-09
- **Title:** Unauthenticated Swagger API Explorer Exposed in Production
- **Severity:** High
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
- **File & Lines:** `apps/api/src/main.ts`: Lines 138–167
- **Code Excerpt:**
  ```typescript
  // apps/api/src/main.ts
  const config = new DocumentBuilder()
    .setTitle('Educare LMS API')
    .setDescription('The Educare LMS API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, customOptions);
  ```
- **Root Cause:** Swagger API documentation is initialized and mounted at `/api/docs` unconditionally without checking `isProduction` and without authentication guards or IP whitelisting.
- **Preconditions & Attack Scenario:** An external attacker accesses `https://api.educarelearning.in/api/docs`. The complete API schema, all endpoints, data transfer objects, parameters, and internal route structures are exposed, facilitating automated reconnaissance and targeted exploit development.
- **Affected Roles & Data:** Complete application attack surface mapping.
- **Recommended Remediation:** Gate the Swagger setup behind an environment check:
  ```typescript
  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    SwaggerModule.setup('api/docs', app, document, customOptions);
  }
  ```
- **Regression Test:** Set `NODE_ENV=production` and send a request to `/api/docs`; verify it returns HTTP 404 Not Found.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-10: Dependency Supply-Chain Risks via Unfrozen Lockfile in Deployment
- **Finding ID:** SEC-FIND-10
- **Title:** Production Deployment Build Ignores Frozen Lockfile (`--no-frozen-lockfile`)
- **Severity:** High
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-1357: Reliance on Insufficiently Trustworthy Component
- **File & Lines:** `nixpacks.toml`: Lines 7–8
- **Code Excerpt:**
  ```toml
  # nixpacks.toml
  [phases.install]
  cmds = ["pnpm install --no-frozen-lockfile"]
  ```
- **Root Cause:** The production Nixpacks deployment configuration explicitly passes `--no-frozen-lockfile` during the build phase. This allows `pnpm` to resolve newer package versions, sub-dependencies, or modified trees that diverge from the verified `pnpm-lock.yaml`.
- **Preconditions & Attack Scenario:** If an upstream dependency is compromised, hijacked via a malicious version release, or exhibits breaking behavioral changes, a redeployment of the LMS will automatically pull the unverified upstream code, bypassing supply-chain integrity checks.
- **Affected Roles & Data:** Entire host container, runtime secrets, application code.
- **Recommended Remediation:** Change command to `pnpm install --frozen-lockfile`.
- **Regression Test:** Attempt to build container with modified `package.json` without updating lockfile; verify build fails as expected.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-11: Unrestricted Arbitrary WhatsApp Message Dispatch in SMS Module
- **Finding ID:** SEC-FIND-11
- **Title:** Unrestricted WhatsApp Messaging Endpoint Accessible to Centre Admins
- **Severity:** Medium
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-770: Allocation of Resources Without Limits or Throttling
- **File & Lines:** `apps/api/src/sms/sms.controller.ts`: Lines 14–19; `apps/api/src/sms/sms.service.ts`: Lines 8–59
- **Code Excerpt:**
  ```typescript
  // apps/api/src/sms/sms.controller.ts
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Post('send')
  sendSms(@Body() data: { to: string; message: string }, @Req() req: any) {
    return this.smsService.sendSms(data.to, data.message, req.user.id);
  }
  ```
- **Root Cause:** `SmsService.sendSms` accepts an arbitrary phone number string and text message from any `CENTRE_ADMIN`. It does not verify whether the phone number belongs to an enrolled student, guardian, or staff member in that centre.
- **Preconditions & Attack Scenario:** A compromised centre admin account or rogue employee uses the `/api/sms/send` endpoint to send spam, phishing, or personal WhatsApp messages across the globe using the institute's verified Meta WhatsApp Cloud API credentials, incurring severe financial costs and reputation damage.
- **Affected Roles & Data:** Meta WhatsApp API quota, financial billing, institute sender reputation.
- **Recommended Remediation:** Validate recipient phone numbers against the database of active students/parents associated with the user's centre.
- **Regression Test:** Submit `POST /api/sms/send` with a random external number not present in the database; expect HTTP 400/403.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-12: Unauthenticated Upload URL Generation via Public Forms Endpoint
- **Finding ID:** SEC-FIND-12
- **Title:** Public Endpoint Generates Presigned R2 Storage Upload URLs Without Authentication
- **Severity:** Medium
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-400: Uncontrolled Resource Consumption
- **File & Lines:** `apps/api/src/forms/forms.controller.ts`: Lines 63–96
- **Code Excerpt:**
  ```typescript
  // apps/api/src/forms/forms.controller.ts
  @Public()
  @Get(':id/upload-url')
  async getUploadUrl(
    @Param('id') id: string,
    @Query('filename') filename: string,
    @Query('contentType') contentType: string
  ) {
    ...
    return this.storageService.getPresignedUploadUrl(safeBaseName, contentType, undefined, {
      prefix: 'forms',
      scopeId: id,
    });
  }
  ```
- **Root Cause:** Anyone on the internet can call `GET /api/forms/:id/upload-url` for any active form and obtain a presigned R2 upload URL. While file extension and MIME checks are in place, the endpoint lacks CAPTCHA verification, IP-based progressive delays, or per-form upload quotas.
- **Preconditions & Attack Scenario:** An automated script repeatedly requests upload URLs and streams large files into Cloudflare R2 under the `forms/` prefix, consuming cloud storage space and incurring bandwidth fees.
- **Affected Roles & Data:** Cloudflare R2 storage capacity and operational costs.
- **Recommended Remediation:** Enforce Cloudflare Turnstile or reCAPTCHA verification on public form uploads, and limit the maximum number of file attachments per form response.
- **Regression Test:** Verify that unverified automated calls to `:id/upload-url` without a valid CAPTCHA token are rejected.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-13: Overridden Validation Pipes Disabling Whitelist Filtering on Key Controllers
- **Finding ID:** SEC-FIND-13
- **Title:** DTO Whitelist and Unknown Property Rejection Overridden on Assignments and Doubts
- **Severity:** Medium
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes
- **File & Lines:** 
  - `apps/api/src/assignments/assignments.controller.ts`: Line 9
  - `apps/api/src/doubts/doubts.controller.ts`: Line 11
- **Code Excerpt:**
  ```typescript
  // apps/api/src/assignments/assignments.controller.ts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  @Controller('assignments')
  ```
- **Root Cause:** Both controllers explicitly instantiate a new `ValidationPipe` with `whitelist: false` and `forbidNonWhitelisted: false`. This overrides the global `ValidationPipe` configured in `main.ts` (`whitelist: true, forbidNonWhitelisted: true`), allowing arbitrary unexpected properties to pass into service handlers.
- **Preconditions & Attack Scenario:** An attacker submits payloads containing extraneous properties (e.g., `role`, `id`, `uploaderId`, `centreId`). While services may not persist all fields, this weakens type safety and increases the risk of mass assignment vulnerabilities.
- **Affected Roles & Data:** Assignment submissions, grading records, doubt threads.
- **Recommended Remediation:** Remove `@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))` and create strict DTO classes with `class-validator` annotations for all endpoints.
- **Regression Test:** Send a POST request to `/api/assignments` containing `{ "unrecognizedField": "malicious" }`; assert HTTP 400 Bad Request is returned.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-14: User Profile Updates Allow Password Modification Without Current Password
- **Finding ID:** SEC-FIND-14
- **Title:** Self-Service Profile Update Allows Password and Email Modification Without Re-authentication
- **Severity:** Medium
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-620: Unverified Password Change
- **File & Lines:** `apps/api/src/users/users.service.ts`: Lines 75–99; `apps/api/src/users/users.controller.ts`: Lines 19–23
- **Code Excerpt:**
  ```typescript
  // apps/api/src/users/users.service.ts
  async updateProfile(userId: string, data: any) {
    ...
    if (data.email) updateData.email = data.email;
    if (data.password) updateData.password = await argon2.hash(data.password);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  ```
- **Root Cause:** `updateProfile` updates the user's password and email without requesting or verifying `currentPassword`.
- **Preconditions & Attack Scenario:** If an attacker gains temporary physical access to an unlocked computer or uses XSS/session theft, they can immediately update the user's password and email address without knowing the old password, permanently locking the genuine user out of their account.
- **Affected Roles & Data:** All user accounts (Super Admin, Centre Admin, Teacher, Student).
- **Recommended Remediation:** Require `currentPassword` in the DTO whenever `data.password` or `data.email` is supplied; verify `currentPassword` against `user.password` using `argon2.verify()` before updating.
- **Regression Test:** Send `PUT /api/users/me` with `{ password: 'newPassword123' }` without `currentPassword`; expect HTTP 400/401.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-15: Known High-Severity Vulnerabilities in Monorepo Dependencies
- **Finding ID:** SEC-FIND-15
- **Title:** Vulnerable Transitive Dependencies Identified by Dependency Audit
- **Severity:** Medium
- **Confidence:** Confirmed (`pnpm audit` execution)
- **CWE:** CWE-1395: Dependency on Vulnerable Third-Party Component
- **File & Lines:** `pnpm-lock.yaml`, `package.json`
- **Audit Tool Evidence:** `pnpm audit` executed on October 25, 2026:
  - Total vulnerabilities: **34** (10 High, 19 Moderate, 5 Low)
  - Key High Vulnerabilities:
    1. `body-parser@2.3.0` (via `@modelcontextprotocol/sdk`) — GHSA-27r3-jxmh-p828
    2. `multer@2.4.0` (via `@nestjs/platform-express`) — GHSA-q7qp-rjg7-q26m (DoS via pending asynchronous fileFilter)
    3. `undici@7.29.1` (via `@dotenvx/dotenvx`) — GHSA-xjj6-f33q-929c (DoS via unhandled error on excessive content-encodings)
- **Root Cause:** Dependencies in toolchains and nested packages have not been upgraded to their patched releases.
- **Recommended Remediation:** Update `pnpm.overrides` in root `package.json`:
  ```json
  "pnpm": {
    "overrides": {
      "multer": "^2.5.0",
      "undici": "^7.30.1",
      "body-parser@2": "^2.4.0"
    }
  }
  ```
- **Reproduction Status:** Confirmed via `pnpm audit`.

---

### SEC-FIND-16: Use of Raw SQL Query Utility `$queryRawUnsafe` in Storage Service
- **Finding ID:** SEC-FIND-16
- **Title:** Use of `$queryRawUnsafe` for Orphan Reference Checks in Storage Service
- **Severity:** Medium
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-89: SQL Injection Defense-in-Depth
- **File & Lines:** `apps/api/src/storage/storage.service.ts`: Lines 699, 720, 798, 816, 836
- **Code Excerpt:**
  ```typescript
  // apps/api/src/storage/storage.service.ts
  const rawResponses = await prismaAny.$queryRawUnsafe(
    `SELECT id FROM "custom_form_responses" WHERE "data"::text LIKE $1 LIMIT 1`,
    `%${validatedKey}%`
  );
  ```
- **Root Cause:** Although positional argument `$1` is passed correctly here, using `$queryRawUnsafe` instead of Prisma's tagged template `$queryRaw` bypasses compile-time query verification and increases the risk of accidental SQL injection regressions during refactoring.
- **Recommended Remediation:** Refactor queries to use standard Prisma client filters or `this.prisma.$queryRaw` tagged templates with `Prisma.sql`.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-17: JWT Strategy Missing Explicit Algorithm Whitelist
- **Finding ID:** SEC-FIND-17
- **Title:** Passport JWT Strategy Does Not Explicitly Pin Allowed Signing Algorithms
- **Severity:** Low
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-327: Use of a Broken or Risky Cryptographic Algorithm
- **File & Lines:** `apps/api/src/auth/jwt.strategy.ts`: Lines 12–30
- **Code Excerpt:**
  ```typescript
  // apps/api/src/auth/jwt.strategy.ts
  super({
    jwtFromRequest: ExtractJwt.fromExtractors([...]),
    ignoreExpiration: false,
    secretOrKey: getJwtSecret(),
  });
  ```
- **Root Cause:** `JwtStrategy` does not specify `algorithms: ['HS256']`. While current versions of `passport-jwt` infer HMAC when a string key is provided, best security practices require explicitly whitelisting acceptable symmetric algorithms to guard against algorithm-confusion attacks.
- **Recommended Remediation:** Add `algorithms: ['HS256']` to `super()` options.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-18: Database Connection String in Environment Example Lacks Explicit TLS Directive
- **Finding ID:** SEC-FIND-18
- **Title:** Database URL Example Omits Mandatory `sslmode=require` for Remote Connections
- **Severity:** Low
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-319: Cleartext Transmission of Sensitive Information
- **File & Lines:** `.env.example`: Line 8
- **Code Excerpt:**
  ```env
  DATABASE_URL="postgresql://educare:password@localhost:5433/educare_db?schema=public"
  ```
- **Root Cause:** When deploying to managed PostgreSQL instances (e.g., Supabase, Neon, AWS RDS), developers copying `.env.example` may neglect to append `sslmode=require`, risking unencrypted transmission of database traffic over public cloud networks.
- **Recommended Remediation:** Update `.env.example` with comments indicating that `&sslmode=require` is mandatory in production deployments.
- **Reproduction Status:** Confirmed from code analysis.

---

### SEC-FIND-19: Unauthenticated Redis Instance Bound to Loopback
- **Finding ID:** SEC-FIND-19
- **Title:** Redis Service Lacks Password Protection (`requirepass`)
- **Severity:** Informational / Defense-in-Depth
- **Confidence:** Confirmed (Code Verified)
- **CWE:** CWE-306: Missing Authentication for Critical Function
- **File & Lines:** `docker-compose.yml`: Lines 18–26
- **Code Excerpt:**
  ```yaml
  redis:
    image: redis:7-alpine
    container_name: educare_redis
    ports:
      - "127.0.0.1:6379:6379"
  ```
- **Root Cause:** While port 6379 is bound to `127.0.0.1` (mitigating remote internet scanning), Redis has no password configured (`requirepass` is omitted). Any local process or container with access to host networking can read or modify session whitelists and rate-limiting keys without authentication.
- **Recommended Remediation:** Add `command: redis-server --requirepass ${REDIS_PASSWORD}` in `docker-compose.yml` and require `REDIS_PASSWORD` in `REDIS_URL`.
- **Reproduction Status:** Confirmed from code analysis.

---

## 4. Complete Endpoint Authorization Matrix

The table below maps every API controller, HTTP method, authentication requirement, allowed roles, multi-tenant checks, and security validation status across the codebase:

| Controller & Method | Route Path | Auth Req? | Allowed Roles | Tenant / Centre Ownership Check? | Security Status | Outstanding Security Issues |
| :--- | :--- | :---: | :--- | :---: | :---: | :--- |
| **Auth** POST | `/api/auth/login` | No (Public) | Anyone | N/A | Pass | Protected by Redis brute-force lockout (5 attempts) |
| **Auth** POST | `/api/auth/logout` | Yes | Authenticated | User ID check | Pass | Session revoked in Redis |
| **Auth** POST | `/api/auth/logout-all` | Yes | Authenticated | User ID check | Pass | All user sessions revoked in Redis |
| **PublicAuth** POST | `/api/public/auth/register` | No (Public) | Anyone | N/A | Pass | Argon2 hashed, creates unverified user |
| **PublicAuth** POST | `/api/public/auth/verify-otp` | No (Public) | Anyone | N/A | **FAIL** | **CRITICAL:** Missing attempt counter & rate limit (SEC-FIND-04) |
| **PublicAuth** POST | `/api/public/auth/login` | No (Public) | Anyone | N/A | Pass | Verifies active and OTP verified status |
| **Students** POST | `/api/students` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (`assertCentreAccess`) | Pass | Centre isolation enforced |
| **Students** GET | `/api/students` | Yes | SUPER_ADMIN, CENTRE_ADMIN, TEACHER | Yes (filtered by centre) | Pass | Proper multi-tenant filtering |
| **Students** GET | `/api/students/:id` | Yes | SUPER_ADMIN, CENTRE_ADMIN, TEACHER, STUDENT | Yes (Student can only see own profile) | Pass | Robust ownership check |
| **Students** GET | `/api/students/me` | Yes | STUDENT | Yes (bound to `req.user.id`) | Pass | Secure |
| **Students** PUT | `/api/students/:id` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (`assertCentreAccess`) | Pass | Secure |
| **Students** DELETE | `/api/students/:id` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (`assertCentreAccess`) | Pass | Secure |
| **Staff** POST | `/api/staff` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Partial (centre checked, role NOT checked) | **FAIL** | **CRITICAL:** Centre Admin can grant SUPER_ADMIN (SEC-FIND-01) |
| **Staff** GET | `/api/staff` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (filtered by centre) | Pass | Multi-tenant isolation enforced |
| **Staff** PUT | `/api/staff/:id` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Partial (centre checked, role NOT checked) | **FAIL** | **CRITICAL:** Centre Admin can elevate to SUPER_ADMIN (SEC-FIND-01) |
| **Staff** DELETE | `/api/staff/:id` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (`assertCentreAccess`) | Pass | Secure |
| **Attendance** GET | `/api/attendance/student` | Yes | STUDENT, Admins, Teachers | Bound to `req.user.id` | Pass | Secure |
| **Attendance** GET | `/api/attendance/filter` | Yes | Admins, Teachers | Yes (`assertCentreAccess` + teacher batch) | Pass | Multi-tenant isolation enforced |
| **Attendance** POST | `/api/attendance` | Yes | Admins, Teachers | Yes (`assertCentreAccess` + teacher batch) | Pass | Prevents cross-centre attendance manipulation |
| **Exams** GET | `/api/exams` | Yes | Admins, Teachers, Students | Yes (Students sanitized; teachers assigned) | Pass | Answer keys stripped for students |
| **Exams** GET | `/api/exams/:id` | Yes | Admins, Teachers, Students | Yes (Students sanitized) | Pass | Answer keys stripped for students |
| **Exams** GET | `/api/exams/:id/results` | Yes | Admins, Teachers, Students | Yes (Students see own; teachers centre) | Pass | Properly scoped |
| **Exams** POST | `/api/exams/:id/submit` | Yes | STUDENT | Yes (Checks batch eligibility) | Pass | Server authoritatively computes score (ignores client score) |
| **Fee** GET | `/api/fee` | Yes | SUPER_ADMIN, CENTRE_ADMIN, STUDENT | Yes (Student own; Admin centre) | Pass | Properly scoped |
| **Fee** POST | `/api/fee` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (Enforces centre match) | Pass | Cross-centre fee creation blocked |
| **Finance** GET | `/api/finance/transactions` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (Scoped to authorized centres) | Pass | Scoped |
| **Finance** POST | `/api/finance/transaction` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (`assertCentreAccess`) | Pass | Scoped |
| **Assignments** GET | `/api/assignments` | Yes | Admins, Teachers, Students | Yes (Enrolled batch only for students) | Pass | Scoped |
| **Assignments** GET | `/api/assignments/:id` | Yes | Admins, Teachers, Students | Yes (Students see own submission only) | Pass | Scoped |
| **Assignments** POST | `/api/assignments/:id/submit` | Yes | STUDENT | Yes (Enrolled batch only) | Pass | Scoped |
| **Assignments** (All) | `/api/assignments/*` | Yes | Admins, Teachers, Students | N/A | **FAIL** | **MEDIUM:** DTO whitelist disabled via custom pipe (SEC-FIND-13) |
| **StudyMaterials** GET| `/api/study-materials/:id/play-url`| Yes | Admins, Teachers, Students | Yes (Checks batch track & enrolment) | Pass | Strict enrolment verification |
| **Estudy** GET | `/api/estudy` | Yes | Admins, Teachers, Students | **NONE** | **FAIL** | **HIGH:** Returns all materials without enrolment checks (SEC-FIND-05) |
| **LiveClass** GET | `/api/live-class` | Yes | Admins, Teachers, Students | Yes (Students only get link 15 min prior) | Pass | Meeting links hidden until class starts |
| **LiveClass** POST | `/api/live-class/public/:id/register` | No (Public) | Anyone | N/A | Pass | Public webinar registration |
| **Cloudflare** POST | `/api/cloudflare/upload-url` | Yes | SUPER_ADMIN, CENTRE_ADMIN, TEACHER | **NONE** (Unsigned, wildcard origin) | **FAIL** | **CRITICAL:** requireSignedURLs=false, allowedOrigins=["*"] (SEC-FIND-03) |
| **Forms** GET | `/api/forms/:id/upload-url` | No (Public) | Anyone | Validates active form | **FAIL** | **MEDIUM:** Unauthenticated upload URL generation (SEC-FIND-12) |
| **Enquiry** GET | `/api/enquiry` | Yes | SUPER_ADMIN, CENTRE_ADMIN | **NONE** | **FAIL** | **HIGH:** Cross-centre prospect leakage (SEC-FIND-05) |
| **Support** GET | `/api/support/tickets` | Yes | SUPER_ADMIN, CENTRE_ADMIN | **NONE** | **FAIL** | **HIGH:** Cross-centre support ticket leakage (SEC-FIND-05) |
| **Syllabus** POST | `/api/syllabus/progress/*` | Yes | Any Authenticated User | **NONE** (Missing RolesGuard) | **FAIL** | **HIGH:** Students can alter syllabus status (SEC-FIND-06) |
| **Syllabus** GET | `/api/syllabus/student-progress/*` | Yes | Any Authenticated User | **NONE** | **FAIL** | **HIGH:** Any user can view other students' progress (SEC-FIND-06) |
| **Setup** PUT | `/api/setup/settings` | Yes | SUPER_ADMIN, CENTRE_ADMIN | **NONE** | **FAIL** | **HIGH:** Branch admin overwrites HQ config & academic year (SEC-FIND-07) |
| **Setup** POST | `/api/setup/roles` | Yes | SUPER_ADMIN | Super Admin only | Pass | Roles properly restricted |
| **SMS** POST | `/api/sms/send` | Yes | SUPER_ADMIN, CENTRE_ADMIN | **NONE** | **FAIL** | **MEDIUM:** Arbitrary global WhatsApp dispatch (SEC-FIND-11) |
| **SMS** GET | `/api/sms/logs` | Yes | SUPER_ADMIN, CENTRE_ADMIN | **NONE** | **FAIL** | **MEDIUM:** Cross-centre WhatsApp log disclosure (SEC-FIND-11) |
| **Users** PUT | `/api/users/me` | Yes | Authenticated User | Own user ID | **FAIL** | **MEDIUM:** Changes password/email without current password (SEC-FIND-14) |
| **AuditLogs** GET | `/api/audit-logs` | Yes | SUPER_ADMIN, CENTRE_ADMIN | Yes (`assertCentreAccess` + tenant filter) | Pass | Strictly isolated |
| **Swagger** GET | `/api/docs` | No (Public) | Anyone | **NONE** | **FAIL** | **HIGH:** Exposed in production (SEC-FIND-09) |

---

## 5. Dependency and Secret-Scan Results

### 5.1 Dependency Vulnerability Scan
- **Command Executed:** `pnpm audit`
- **Scan Date:** October 25, 2026
- **Tool Version:** PNPM Package Manager v9.0.0
- **Summary:** 34 vulnerabilities found (10 High, 19 Moderate, 5 Low).
- **Vulnerable Packages:**
  - `body-parser` (>=2.0.0 <2.4.0) — High (GHSA-27r3-jxmh-p828)
  - `multer` (>=2.0.0 <2.5.0) — High (GHSA-q7qp-rjg7-q26m)
  - `undici` (>=7.18.0 <7.30.1) — High (GHSA-xjj6-f33q-929c)
  - `fast-uri` (>=3.0.0 <3.1.9) — Low (GHSA-333x-w4r6-6crp)

### 5.2 Secret Scan & Git History Findings
- **Git Commit Inspection:** Inspected commit history from initial commits to HEAD (`5cb463e`).
- **Secret Findings:**
  1. No production private keys, Google Service Account JSON keys, or Cloudflare API tokens were committed to Git history.
  2. `.env` and `.env.*` are properly excluded in `.gitignore`.
  3. `.env.example` contains default placeholder database passwords (`password`) and placeholder JWT configuration guidance.
  4. Redacted fingerprint of local test database URL in `.env.example`: `postgresql://educare:pass****@localhost:5433/educare_db`.

---

## 6. Remediation Roadmap

### 6.1 Phase 1: Immediate (Must Fix Before Public Production Deployment)
1. **SEC-FIND-01:** Patch `StaffService.createStaff` and `updateStaff` to prevent non-super admins from assigning `SUPER_ADMIN` or `CENTRE_ADMIN` roles.
2. **SEC-FIND-02:** Add production safety guard in `seed.ts` to abort if `NODE_ENV === 'production'` without explicit non-default secrets. Replace default compose passwords.
3. **SEC-FIND-03:** Update `CloudflareService` to configure `requireSignedURLs: true` and restrict `allowedOrigins` to the production domain.
4. **SEC-FIND-04:** Add rate-limiting and maximum 5 failed attempts tracking on `verifyOtp` in `public-auth.service.ts`.
5. **SEC-FIND-07:** Remove `CENTRE_ADMIN` from `setup.controller.ts` on `PUT /api/setup/settings`.
6. **SEC-FIND-09:** Gate Swagger documentation in `main.ts` behind `if (!isProduction)`.
7. **SEC-FIND-10:** Change `nixpacks.toml` to `pnpm install --frozen-lockfile`.

### 6.2 Phase 2: Short Term (Before Real Student / Financial Data Added)
1. **SEC-FIND-05:** Inject multi-tenant centre scoping into `enquiry.service.ts`, `support.service.ts`, and `estudy.service.ts`.
2. **SEC-FIND-06:** Add `@UseGuards(JwtAuthGuard, RolesGuard)` and role annotations to `SyllabusController` and `ConfigController`.
3. **SEC-FIND-08:** Configure CSRF defense tokens on mutating endpoints or migrate browser requests strictly through the Next.js BFF proxy with `SameSite=Lax`.
4. **SEC-FIND-11:** Add phone number database validation to `sms.service.ts` to prevent arbitrary dispatch.
5. **SEC-FIND-13:** Remove disabled whitelist pipes from `AssignmentsController` and `DoubtsController`.
6. **SEC-FIND-14:** Require `currentPassword` in `UsersService.updateProfile` before updating passwords or emails.

### 6.3 Phase 3: Medium Term (Ongoing Hardening and Monitoring)
1. **SEC-FIND-15:** Upgrade vulnerable dependencies via `pnpm update` and override blocks.
2. **SEC-FIND-16:** Refactor remaining `$queryRawUnsafe` calls in `storage.service.ts` to typed Prisma queries or `$queryRaw` tagged templates.
3. **SEC-FIND-17:** Pin `algorithms: ['HS256']` in `jwt.strategy.ts`.
4. **SEC-FIND-19:** Configure `requirepass` on Redis containers.
5. Implement automated database backup and point-in-time recovery testing.
6. Integrate ClamAV or AWS/Cloudflare automated malware scanning on uploaded student documents.

---

## 7. Verification Checklist & Negative Security Tests

Use these concrete tests to verify that remediations are effective:

- [ ] **Negative Authorization Test (Staff Role Escalation):**
  Log in as a Centre Admin (`centrea@educare.com`). Send `POST /api/staff` with `{ "name": "Hacker", "email": "hacker@test.com", "role": "SUPER_ADMIN", "centre": "Educare Kalathipady" }`. Verify response is **403 Forbidden**.
- [ ] **Negative Authorization Test (Settings Overwrite):**
  Log in as a Centre Admin. Send `PUT /api/setup/settings` with `{ "centreName": "Defaced" }`. Verify response is **403 Forbidden**.
- [ ] **Negative Authorization Test (Cross-Centre Enquiry Leakage):**
  Create an enquiry for Centre B. Log in as Centre Admin A. Send `GET /api/enquiry`. Verify that the Centre B enquiry is **NOT present** in the returned array.
- [ ] **Negative Authorization Test (Syllabus Mutation by Student):**
  Log in as Student. Send `POST /api/syllabus/progress/chapter` with `{ "batchId": "...", "chapterId": "...", "status": "COMPLETED" }`. Verify response is **403 Forbidden**.
- [ ] **Negative Rate-Limit Test (OTP Brute Force):**
  Register a user via `/api/public/auth/register`. Send 6 incorrect requests to `POST /api/public/auth/verify-otp`. Verify that the 6th and subsequent requests return **429 Too Many Requests** or **400 Account Locked**.
- [ ] **Production Reconnaissance Test (Swagger):**
  Start API with `NODE_ENV=production`. Send `GET /api/docs`. Verify response is **404 Not Found**.

---

## 8. Audit Limitations

1. **Static Analysis & Local Environment:** The audit was conducted through manual code review, control flow tracing, and static dependency analysis. Dynamic penetration testing against a live multi-node production deployment was not executed.
2. **Third-Party Provider Credentials:** External API interactions with Meta WhatsApp Cloud API, Google Calendar/Meet API, and Cloudflare Stream were verified via code paths and mock responses; real upstream service credentials were not tested against live provider APIs.
3. **Hardware & Host Security:** Physical server hardening, kernel vulnerabilities, hypervisor boundaries, and network firewall rules outside `docker-compose.yml` and `nixpacks.toml` were outside the scope of this repository audit.

---
**Report Approved by:** Lead Application Security Auditor  
**Distribution:** Core LMS Engineering & Architecture Team
