# EduCare LMS — Staging Infrastructure Plan & Environment Specification

## 1. Executive Summary & Infrastructure Scope

- **Working Branch**: `fix/authorization-remediation`
- **Base Commit**: `9c316b0` (`fix(security): add idempotent custom_forms centreId migration and document disposable db verification`)
- **Document Version**: 1.0.0
- **Auditor / Author**: `nonstradamoz <nonstradamoz@users.noreply.github.com>`
- **Scope**: Comprehensive blueprint for provisioning, configuring, and verifying a genuinely isolated staging environment for EduCare LMS.

> [!IMPORTANT]
> **Boundary Statement: Executed Checks vs Recommendations**
> - **Executed Checks (Validated in Local Staging Cluster)**:
>   - Verified all 10 Prisma migrations deployed in order (`127.0.0.1:5433`).
>   - Confirmed schema constraints (`custom_forms.centreId` FK, `study_materials.isPublic`, `study_materials.isShared`).
>   - Confirmed zero-write dry-run reconciliation for enquiries and study materials.
>   - Confirmed 11 cross-centre authorization scenarios across 8 roles.
>   - Confirmed 414/414 passing API tests, Next.js web build (39 routes), and Expo mobile typecheck.
> - **Pending Recommendations (External Staging Infrastructure)**:
>   - Provisioning of external isolated staging PostgreSQL database and authenticated Redis 7 server.
>   - Provisioning of dedicated Cloudflare R2 staging bucket and staging Turnstile widget credentials.
>   - Ingress controller configuration and tight CIDR specification for `TRUSTED_PROXIES`.
> 
> **Status**: The application code is staging-ready. Staging is **NOT** operational until the isolated external cloud services documented herein have been provisioned and confirmed.

---

## 2. Environment-Variable Loading & Deployment Audit (Task 1)

### A. Environment Configuration Files in Repository
The repository contains the following environment configuration files:

| File Path | Purpose / Scope | Committed vs Gitignored |
| :--- | :--- | :--- |
| `packages/database/.env` | Prisma CLI and database migration target | Gitignored (`.env` in `.gitignore`) |
| `apps/api/.env` | Backend API runtime configuration | Gitignored (`.env` in `.gitignore`) |
| `apps/web/.env` | Next.js web application frontend and BFF | Gitignored (`.env` in `.gitignore`) |
| `.env` (root) | Monorepo fallback environment configuration | Gitignored (`.env` in `.gitignore`) |
| `.env.example` (root) | Template for developers and infrastructure | Committed |
| `apps/mobile/.env.example` | Template for Expo React Native mobile app | Committed |
| `docker-compose.yml` | Local containerized PostgreSQL and Redis definitions | Committed |

### B. Required Infrastructure Variables & Consumer Mapping

| Variable Name | Sensitive | Component / Consumer | Purpose & Usage Details |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | `packages/database` (Prisma CLI), `apps/api` (`PrismaService`), Reconciliation scripts | PostgreSQL connection URI including username, password, host, port, database name, and SSL parameters. |
| `REDIS_URL` | Yes | `apps/api` (`RedisService`, `StrictThrottlerGuard`, `AppModule`, `ExamsService`) | Redis connection URI with host, port, and authentication password for distributed rate limiting and token invalidation. |
| `JWT_SECRET` | Yes | `apps/api` (`AuthService`, `JwtStrategy`, `BffService`) | Secret key used to sign and verify HMAC-SHA256 JWT access and refresh tokens. Must be >= 32 characters. |
| `TURNSTILE_SECRET_KEY` | Yes | `apps/api` (`EnquiryService.verifyTurnstileToken`) | Cloudflare Turnstile shared secret used in server-to-server `siteverify` API calls to validate captcha tokens. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | `apps/web` (`apps/web/src/app/admission/page.tsx`) | Public client-side Turnstile sitekey rendered in the frontend captcha widget. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | `apps/api` (`StorageService`), `apps/web` | Cloudflare account identifier for Stream and R2 bucket access. |
| `CLOUDFLARE_STREAM_API_TOKEN` | Yes | `apps/api` (`StudyMaterialsService`, `StorageService`) | Bearer API token authorized for Cloudflare Stream video upload, processing, and direct playback URL generation. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Yes | `apps/api` (`StorageService`) | S3-compatible Access Key ID for Cloudflare R2 object storage. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Yes | `apps/api` (`StorageService`) | S3-compatible Secret Access Key for Cloudflare R2 object storage. |
| `CLOUDFLARE_R2_BUCKET_NAME` | No | `apps/api` (`StorageService`), `apps/web` | Target R2 bucket name (e.g. `educare-staging`). |
| `CLOUDFLARE_R2_PUBLIC_DOMAIN` | No | `apps/api` (`StorageService`), `apps/web` | Public CDN domain name for reading public R2 assets. |
| `LIVEKIT_WS_URL` | No | `apps/api` (`LiveClassesService`), `apps/web` (`/live/[id]`) | WebSocket endpoint for LiveKit WebRTC video rooms (e.g. `wss://educarelms-staging.livekit.cloud`). |
| `LIVEKIT_API_KEY` | Yes | `apps/api` (`LiveClassesService`) | LiveKit API Key for room generation and token minting. |
| `LIVEKIT_API_SECRET` | Yes | `apps/api` (`LiveClassesService`) | LiveKit API Secret for room authentication tokens. |
| `TRUSTED_PROXIES` | No | `apps/api` (`main.ts`, `StrictThrottlerGuard`) | Comma-separated list of trusted upstream proxy IP addresses or CIDR subnets (e.g. AWS ALB, Cloudflare, NGINX). |
| `CORS_ORIGINS` | No | `apps/api` (`main.ts`) | Comma-separated list of allowed web frontend origins (e.g. `https://staging.educarelearning.in`). |
| `INTERNAL_API_URL` | No | `apps/web` (`apps/web/src/lib/bff-config.ts`) | Upstream API endpoint used by the Next.js server-side BFF proxy. |
| `NEXT_PUBLIC_API_URL` | No | `apps/web` (`apps/web/src/lib/bff-config.ts`) | Fallback API URL for web client requests. |
| `EXPO_PUBLIC_API_URL` | No | `apps/mobile` (`apps/mobile/src/api/client.ts`) | Public API endpoint for the React Native mobile application. |
| `NODE_ENV` / `APP_ENV` | No | All services | Runtime environment tier (`production`, `staging`, `development`, `test`). |

---

## 3. Database URL Resolution Trace Across Runtimes (Task 2)

A common operational error is assuming that modifying `packages/database/.env` updates every runtime. The following trace establishes how each component resolves `DATABASE_URL`:

```mermaid
flowchart TD
    subgraph PrismaCLI ["1. Prisma CLI"]
        P1["Shell env: process.env.DATABASE_URL"] -->|Precedence 1| PTarget["Prisma Engine Target"]
        P2["packages/database/.env"] -->|Precedence 2| PTarget
    end

    subgraph APIRuntime ["2. NestJS API Runtime"]
        A1["Shell env: process.env.DATABASE_URL"] -->|Precedence 1| ATarget["PrismaService (Client)"]
        A2["apps/api/src/common/config/env.loader.ts"] -->|Precedence 2| ATarget
        A3["Traverses: apps/api/.env, packages/database/.env, root .env"] --> A2
    end

    subgraph ReconciliationScripts ["3. Reconciliation CLI"]
        R1["Shell env: process.env.DATABASE_URL"] -->|Precedence 1| RTarget["reconcileLegacy*()"]
        R2["packages/database/.env"] -->|Precedence 2| RTarget
    end

    subgraph WebApp ["4. Next.js Web Application"]
        W1["apps/web/.env (or process.env)"] --> WTarget["BFF Proxy (/api/proxy)"]
        WTarget -->|HTTP / HTTPS| ATarget
    end
```

### Detailed Resolution Breakdown:
1. **Prisma CLI (`packages/database`)**:
   - `prisma migrate deploy`, `prisma migrate status`, `prisma db seed` are executed from `packages/database`.
   - Prisma CLI natively inspects `packages/database/.env`.
   - **Precedence Rule**: If `DATABASE_URL` is exported in the calling shell environment, Prisma overrides `.env` with the shell variable. Otherwise, it falls back to `packages/database/.env`.
2. **NestJS API Runtime (`apps/api`)**:
   - `apps/api/src/main.ts` immediately imports `./common/config/env.loader`.
   - `env.loader.ts` recursively checks upward directories and candidate files (`.env`, `.env.local`, `.env.production`).
   - It populates `process.env[key]` **only if not already set** (`applyEnvContent`).
   - `PrismaService` extends `PrismaClient` without constructor overrides, which reads `process.env.DATABASE_URL`.
   - **Crucial Takeaway**: Changing `packages/database/.env` will propagate to the API runtime **only if** `apps/api/.env` and root `.env` do not declare a conflicting `DATABASE_URL`, and the variable is not set in the shell/container environment.
3. **Reconciliation Scripts (`packages/database/prisma/scripts/*`)**:
   - Executed via `pnpm --filter @educare/database reconcile:enquiries` and `reconcile:materials`.
   - Because they run in the `packages/database` working directory, they follow Prisma CLI rules, loading `packages/database/.env` unless overridden in the shell.
4. **Next.js Web Runtime (`apps/web`)**:
   - Does **not** read `DATABASE_URL` and contains no direct database driver.
   - All database communication is proxied through the BFF router (`/api/proxy/[...path]`) to `INTERNAL_API_URL`.

---

## 4. Redacted Staging Environment Template (Task 3)

Save as `.env.staging` (or inject into your staging container orchestrator / secret manager):

```env
# =============================================================================
# EDUCARE LMS — STAGING ENVIRONMENT TEMPLATE
# All sensitive credentials use <PLACEHOLDERS>. Never commit real secrets.
# =============================================================================

# -----------------------------------------------------------------------------
# Runtime & Environment Scoping
# -----------------------------------------------------------------------------
NODE_ENV=staging
APP_ENV=staging
PORT=3001

# -----------------------------------------------------------------------------
# Isolated Staging Database (PostgreSQL 14+)
# MUST include sslmode=require if database is remote/cloud-hosted.
# MUST NOT point to production IP (148.135.138.196).
# -----------------------------------------------------------------------------
DATABASE_URL="postgresql://educare_staging:<STAGING_DB_PASSWORD>@<STAGING_DB_HOST>:5432/educare_staging?schema=public&sslmode=require"

# -----------------------------------------------------------------------------
# Dedicated Authenticated Staging Redis (Redis 7+)
# Mandatory in staging for distributed rate limiting and session management.
# -----------------------------------------------------------------------------
REDIS_URL="redis://:<STAGING_REDIS_PASSWORD>@<STAGING_REDIS_HOST>:6379"

# -----------------------------------------------------------------------------
# Authentication & Tokens
# Minimum 32-character high-entropy secret.
# -----------------------------------------------------------------------------
JWT_SECRET="<STAGING_HIGH_ENTROPY_JWT_SECRET_MIN_32_CHARS>"

# -----------------------------------------------------------------------------
# Cloudflare Turnstile (Staging Domain Scoped)
# -----------------------------------------------------------------------------
TURNSTILE_SECRET_KEY="<STAGING_TURNSTILE_SECRET_KEY>"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="<STAGING_TURNSTILE_SITE_KEY>"

# -----------------------------------------------------------------------------
# Dedicated Staging Cloudflare R2 Object Storage
# -----------------------------------------------------------------------------
CLOUDFLARE_ACCOUNT_ID="<STAGING_CLOUDFLARE_ACCOUNT_ID>"
CLOUDFLARE_STREAM_API_TOKEN="<STAGING_STREAM_API_TOKEN>"
CLOUDFLARE_R2_ACCESS_KEY_ID="<STAGING_R2_ACCESS_KEY_ID>"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="<STAGING_R2_SECRET_ACCESS_KEY>"
CLOUDFLARE_R2_BUCKET_NAME="educare-staging"
CLOUDFLARE_R2_PUBLIC_DOMAIN="staging-media.educarelearning.in"

# -----------------------------------------------------------------------------
# Dedicated Staging LiveKit Video Infrastructure
# -----------------------------------------------------------------------------
LIVEKIT_WS_URL="wss://educarelms-staging.livekit.cloud"
LIVEKIT_API_KEY="<STAGING_LIVEKIT_API_KEY>"
LIVEKIT_API_SECRET="<STAGING_LIVEKIT_API_SECRET>"

# -----------------------------------------------------------------------------
# Networking, Ingress & Security Headers
# TRUSTED_PROXIES must be restricted strictly to ingress controller CIDRs.
# -----------------------------------------------------------------------------
TRUSTED_PROXIES="10.0.1.0/24"
CORS_ORIGINS="https://staging.educarelearning.in"

# -----------------------------------------------------------------------------
# Frontend BFF Upstream Binding
# -----------------------------------------------------------------------------
INTERNAL_API_URL="https://staging-api.educarelearning.in/api"
NEXT_PUBLIC_API_URL="https://staging-api.educarelearning.in/api"
EXPO_PUBLIC_API_URL="https://staging-api.educarelearning.in/api"
```

---

## 5. Startup & Preflight Safety Checks (Task 4)

To prevent misconfigured deployments and protect production data from accidental mutations, safe preflight validations have been implemented:

### A. API Runtime Preflight (`apps/api/src/main.ts`)
The `runPreflightSafetyChecks()` function executes immediately during `bootstrap()` before initializing listeners:
1. **Target Isolation Assertion**:
   When `NODE_ENV === 'staging'` or `APP_ENV === 'staging'`, `DATABASE_URL` is checked for the production IP (`148.135.138.196`). If detected, the API terminates immediately:
   ```
   FATAL: Staging environment DATABASE_URL points to unauthorized production host (148.135.138.196). Startup aborted to protect production data.
   ```
2. **Redis Mandate**:
   In both `production` and `staging`, `REDIS_URL` is verified. If missing, startup throws:
   ```
   FATAL: REDIS_URL is mandatory in staging for secure session enforcement and distributed rate limiting.
   ```
3. **Cryptographic Secret Verification**:
   Validates `JWT_SECRET` is at least 32 characters long and does not match known default passwords (`'secret'`, `'changeme'`, `'development'`).
4. **Turnstile Secret Check**:
   Ensures `TURNSTILE_SECRET_KEY` is configured so public enquiry routes fail closed rather than serving unprotected intake.

### B. Reconciliation Script Guard (`backfill-enquiry-centres.ts` & `backfill-study-material-centres.ts`)
A strict check was added to both scripts when `--apply` is passed:
```ts
if (isApply) {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('148.135.138.196') && process.env.ALLOW_PRODUCTION_RECONCILIATION !== 'true') {
    console.error('FATAL SAFETY GUARD: Target database URL points to production host (148.135.138.196). Apply mode is prohibited without explicit ALLOW_PRODUCTION_RECONCILIATION=true confirmation.');
    process.exit(1);
  }
}
```
**Zero-Leak Guarantee**: Error messages never log connection strings, tokens, or usernames.

---

## 6. Infrastructure Provisioning, Network & Security Specifications (Task 5)

### A. PostgreSQL 14+ Staging Provisioning
1. **Database & Role Setup**:
   ```sql
   CREATE USER educare_staging WITH PASSWORD '<SECURE_RANDOM_PASSWORD>';
   CREATE DATABASE educare_staging OWNER educare_staging;
   GRANT ALL PRIVILEGES ON DATABASE educare_staging TO educare_staging;
   ```
2. **TLS Mandate**:
   - PostgreSQL `postgresql.conf` must enforce `ssl = on`.
   - Client connection strings must append `&sslmode=require`.

### B. Redis 7+ Staging Provisioning
1. **Password Enforcement**:
   - In `redis.conf`:
     ```conf
     requirepass <STAGING_REDIS_PASSWORD>
     bind 127.0.0.1 <INTERNAL_VPC_IP>
     protected-mode yes
     ```
2. **Containerized Setup (Docker Compose for Staging)**:
   ```yaml
   staging_redis:
     image: redis:7-alpine
     command: redis-server --requirepass ${STAGING_REDIS_PASSWORD}
     ports:
       - "127.0.0.1:6379:6379"
   ```

### C. Firewall Rules & Network Topology
- **PostgreSQL Port 5432**: Closed to the public internet (`0.0.0.0/0`). Ingress allowed exclusively from the staging API VPC security group (`sg-staging-api`) or localhost.
- **Redis Port 6379**: Closed to the public internet. Accessible only by staging API replicas.
- **API Port 3001**: Accessible only through the staging Ingress/Load Balancer.
- **Ingress Proxy (`TRUSTED_PROXIES`)**:
  - Bound strictly to the ingress subnet CIDR (e.g. `10.0.1.0/24`).
  - Broad RFC 1918 CIDRs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are strictly forbidden.

### D. Secret Management
- Secrets must **never** be stored in git repositories.
- Use an encrypted secret manager (e.g. AWS Secrets Manager, HashiCorp Vault, Doppler, or GitHub Actions Environments).
- If using file-based `.env` on staging VPS instances, enforce strict OS permissions:
  ```bash
  chmod 600 .env.staging
  chown educare:educare .env.staging
  ```

### E. Health Checks & Monitoring
- **API Health**: `GET /health` returns `200 OK` (unauthenticated).
- **Database Probe**: Query `SELECT 1;` every 30 seconds via orchestrator liveness probe.
- **Redis Probe**: `redis-cli ping` expecting `PONG`.

---

## 7. Rollback & Forward-Fix Recovery Strategy (Task 6)

### A. Deprecation of Destructive History Edits
Earlier reports suggested manually executing:
`DELETE FROM "_prisma_migrations" WHERE "migration_name" = '...';`

> [!CAUTION]
> **Why Deleting From `_prisma_migrations` is Prohibited**:
> Prisma's migration engine verifies applied migration checksums against local migration files. Manually deleting rows from `_prisma_migrations` causes checksum mismatch errors, desynchronizes development and staging environments, and causes subsequent `prisma migrate deploy` commands to crash with exit code 1.

### B. Standard Staging/Production Recovery Plan

```mermaid
graph TD
    IssueDetected{Issue Detected Post-Migration?}
    IssueDetected -->|Immediate Abort Before Writes| PITR[Option 1: Atomic Snapshot Restore]
    IssueDetected -->|Post-Write Production Fix| ForwardFix[Option 2: Forward-Fix Migration]
    
    PITR --> RestoreDB["pg_restore --clean --if-exists"]
    PITR --> RevertApp["Revert Container to Previous Tag"]
    
    ForwardFix --> CreateMig["Create Reversal Migration SQL"]
    ForwardFix --> DeployMig["prisma migrate deploy"]
    ForwardFix --> KeepHistory["Preserve Complete Audit Trail"]
```

1. **Option 1: Atomic Snapshot Restore (Pre-Write Recovery)**
   - Pre-deployment backup:
     ```bash
     pg_dump -h <STAGING_DB_HOST> -p 5432 -U educare_staging -d educare_staging -Fc -f educare_staging_pre_deploy.dump
     ```
   - Atomic rollback:
     ```bash
     pg_restore -h <STAGING_DB_HOST> -p 5432 -U educare_staging -d educare_staging --clean --if-exists educare_staging_pre_deploy.dump
     ```
   - Restores database data and `_prisma_migrations` atomically.

2. **Option 2: Forward-Fix Migration (Standard Post-Write Recovery)**
   - Create a forward migration that safely drops the new column or constraint without rewriting history:
     ```sql
     -- migrations/20261026_revert_custom_form_centre/migration.sql
     ALTER TABLE "custom_forms" DROP CONSTRAINT IF EXISTS "custom_forms_centreId_fkey";
     ALTER TABLE "custom_forms" DROP COLUMN IF EXISTS "centreId";
     ```
   - Deploy using `pnpm --filter @educare/database prisma migrate deploy`.
   - Preserves migration integrity and prevents schema drift across branches.

3. **Application Container Rollback**:
   - Revert application image to the previous container release tag.
   - All migrations on branch `fix/authorization-remediation` add nullable columns with defaults (`isPublic: false`, `centreId: null`), making them 100% backward-compatible with older application versions.

---

## 8. Reconciled Test Summary (Task 7)

Executed on macOS with Node.js 22 and Jest test runner:
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter api test -- --runInBand --forceExit
```

### Verified Test Runner Output:
- **Test Suites**: **17 passed, 17 total**
- **Tests**: **414 passed, 414 total**
- **Skipped Tests**: **0**
- **Failed Tests**: **0**
- **Snapshots**: **0**

### Reconciled Suite Breakdown:
| Suite Name | File Location | Tests | Status |
| :--- | :--- | :-: | :-: |
| **Dedicated Authorization Remediation Suite** | `apps/api/src/common/authorization-remediation.spec.ts` | **101** | **PASS** |
| **Comprehensive Security Regression Suite** | `apps/api/src/common/security-regression.spec.ts` | **298** | **PASS** |
| **Enquiry Controller Suite** | `apps/api/src/enquiry/enquiry.controller.spec.ts` | **1** | **PASS** |
| **Enquiry Service Suite** | `apps/api/src/enquiry/enquiry.service.spec.ts` | **1** | **PASS** |
| **Assignments Controller Suite** | `apps/api/src/assignments/assignments.controller.spec.ts` | **1** | **PASS** |
| **Assignments Service Suite** | `apps/api/src/assignments/assignments.service.spec.ts` | **1** | **PASS** |
| **SMS Controller Suite** | `apps/api/src/sms/sms.controller.spec.ts` | **1** | **PASS** |
| **SMS Service Suite** | `apps/api/src/sms/sms.service.spec.ts` | **1** | **PASS** |
| **Finance Controller Suite** | `apps/api/src/finance/finance.controller.spec.ts` | **1** | **PASS** |
| **Finance Service Suite** | `apps/api/src/finance/finance.service.spec.ts` | **1** | **PASS** |
| **Attendance Controller Suite** | `apps/api/src/attendance/attendance.controller.spec.ts` | **1** | **PASS** |
| **Attendance Service Suite** | `apps/api/src/attendance/attendance.service.spec.ts` | **1** | **PASS** |
| **Report Controller Suite** | `apps/api/src/report/report.controller.spec.ts` | **1** | **PASS** |
| **Report Service Suite** | `apps/api/src/report/report.service.spec.ts` | **1** | **PASS** |
| **Fee Controller Suite** | `apps/api/src/fee/fee.controller.spec.ts` | **1** | **PASS** |
| **Fee Service Suite** | `apps/api/src/fee/fee.service.spec.ts` | **1** | **PASS** |
| **App Controller Suite** | `apps/api/src/app.controller.spec.ts` | **1** | **PASS** |
| **TOTAL** | **17 Test Suites** | **414** | **PASS** |

---

## 9. Staging Readiness Checklist & Remaining Blockers

### A. Pre-Deployment Staging Checklist
- [ ] **1. Infrastructure Provisioning**:
  - [ ] Provision isolated staging PostgreSQL 14+ database (`educare_staging`).
  - [ ] Provision dedicated Redis 7+ instance with `requirepass` enabled.
  - [ ] Provision dedicated Cloudflare R2 bucket (`educare-staging`).
  - [ ] Provision dedicated LiveKit staging project.
- [ ] **2. Credential Injection**:
  - [ ] Populate `.env.staging` using the redacted template in Section 4.
  - [ ] Verify `DATABASE_URL` uses `sslmode=require` and does not point to `148.135.138.196`.
  - [ ] Verify `REDIS_URL` contains the staging password.
  - [ ] Generate high-entropy `JWT_SECRET` (>= 32 chars).
- [ ] **3. Ingress & Hostname Approvals**:
  - [ ] Configure `TRUSTED_PROXIES` to match staging ingress controller VPC CIDR.
  - [ ] Add staging hostname (`staging.educarelearning.in`) to Cloudflare Turnstile dashboard.
  - [ ] Verify `defaultHostnames` in `enquiry.service.ts` includes the staging domain.
- [ ] **4. Staging Deployment Execution**:
  - [ ] Take pre-migration database snapshot (`pg_dump`).
  - [ ] Deploy migrations using `pnpm --filter @educare/database prisma migrate deploy`.
  - [ ] Run dry-run reconciliation:
    ```bash
    pnpm --filter @educare/database reconcile:enquiries
    pnpm --filter @educare/database reconcile:materials
    ```
  - [ ] Confirm 0 database writes occur during dry-run.
- [ ] **5. Live Integration Smoke Test**:
  - [ ] Submit test admission enquiry on `/admission` and verify Turnstile validation passes.
  - [ ] Verify rate limiting across 2+ API replicas via Redis.
  - [ ] Log in as Centre Admin Alpha and verify inability to see Centre Beta data.

### B. Remaining Blockers Preventing Production Release
1. **Target Infrastructure Separation**: A physical or managed staging PostgreSQL database completely detached from `148.135.138.196` must be provisioned.
2. **Authenticated Redis Staging Instance**: Staging environment currently lacks an active Redis instance.
3. **Dedicated Staging Cloudflare Credentials**: Staging cannot use production R2 buckets or production Turnstile site keys.
