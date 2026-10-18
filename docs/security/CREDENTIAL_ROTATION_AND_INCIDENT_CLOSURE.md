# Educare LMS — Credential Rotation & Secret Incident Closure Report

**Document ID:** SEC-OP-2026-001  
**Classification:** Internal Operational Security  
**Date:** 2026-10-18  
**Scope:** Historical secret exposure investigation (`scratch.ts`), credential revocation, cloud audit inspection, and incident closure verification.

---

## 1. Incident Overview & Investigation Findings

### 1.1 Exposure Context
During development testing of RSA-SHA256 signature formatting and regex string manipulation, a scratch file named `scratch.ts` was added to the repository root and subsequently deleted in commit [`d246cbd`](https://github.com/nonstradamoz/educare_lms/commit/d246cbd7a332ff08967db026001fcd4c4e6235fb).

### 1.2 Credential Analysis
- **Key Type:** RSA 2048-bit PKCS#8 private key (`-----BEGIN PRIVATE KEY-----`).
- **File Content:** Standalone script testing newline replacement and `crypto.createSign('RSA-SHA256')`.
- **Finding:** While the file was used to test string formatting for RSA JWT/service account signing, best practices dictate that **deletion alone does not constitute remediation**. Any key that has been stored in a git repository—even temporarily or for test purposes—must be treated as compromised.

---

## 2. Mandatory Credential Rotation Procedures

To ensure complete account-level incident closure, the following rotation steps must be performed in your cloud management consoles:

### 2.1 Google Cloud Platform (GCP) / Firebase Service Account Key
If this key originated from a GCP/Firebase service account:
1. Log in to the [Google Cloud Console](https://console.cloud.google.com/) -> **IAM & Admin** -> **Service Accounts**.
2. Locate the service account used by Educare LMS (e.g. `firebase-adminsdk` or backend notification service).
3. Under the **Keys** tab:
   - Identify any key created around or prior to the exposure window.
   - Click **Add Key** -> **Create new key** (JSON format) and download the new credential.
   - Update your production environment variable (`FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`).
   - After verifying backend deployment with the new key, **Delete** the old key from the console.

### 2.2 Cloudflare R2 API Tokens
If R2 storage credentials were used in testing:
1. Navigate to the **Cloudflare Dashboard** -> **R2** -> **Manage R2 API Tokens**.
2. Click **Create API Token** with Admin or Object Read & Write permissions scoped to `educare-materials`.
3. Update production environment variables:
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
4. Once deployed and verified, click **Revoke** on the previous API token.

### 2.3 JWT Signing Secret & Session Revocation
1. Rotate `JWT_SECRET` in production `.env`.
2. Trigger complete session invalidation:
   - Invoke `POST /auth/logout-all` or flush Redis user session keys (`educare:user:*:sessions`).
   - This ensures any potentially forged or historical tokens are rendered immediately invalid.

---

## 3. Cloud Audit Log Verification

Before closing this incident, verify that no unauthorized API requests were made using historical credentials:

1. **Google Cloud Audit Logs:**
   - In Cloud Logging Query:
     ```text
     protoPayload.authenticationInfo.principalEmail="<service-account-email>"
     timestamp >= "2026-10-15T00:00:00Z"
     ```
   - Confirm that all IP addresses and User-Agents correspond to known Educare production servers and CI/CD pipelines.
2. **Cloudflare Audit Logs:**
   - Navigate to **Account** -> **Audit Log**.
   - Filter by `Category: R2` and verify that all bucket actions originated from authorized infrastructure.

---

## 4. Git History Management & Repository Policy

1. **Pre-commit Secret Scanning:**
   - Ensure tools like `gitleaks` or GitHub Secret Scanning remain enabled on the repository.
   - The root `.gitignore` has been updated to permanently ignore `scratch.*`, `*.pem`, `*.key`, and `.env*`.
2. **Repository History:**
   - Following industry standards (e.g., NIST SP 800-61 and GitHub Security Best Practices), **credential rotation takes absolute precedence over git history rewriting**.
   - Once all credentials have been rotated in the upstream cloud provider, any historical key in git commits is cryptographically inert.

---

## 5. Verification Checklist & Sign-off

| Step | Action | Status | Verified By |
|------|--------|--------|-------------|
| 1 | `scratch.ts` permanently removed from working tree and `.gitignore` updated | ✅ Completed | Automated Audit |
| 2 | Production `.env` checked for hardcoded secrets | ✅ Completed | Automated Audit |
| 3 | GCP/Firebase Service Account key rotated | 🔲 Operational Action Required | Operator Sign-off |
| 4 | Cloudflare R2 API Token rotated | 🔲 Operational Action Required | Operator Sign-off |
| 5 | Cloud audit logs reviewed for anomalous IP requests | 🔲 Operational Action Required | Operator Sign-off |
| 6 | Incident officially declared closed in security register | 🔲 Final Sign-off | Security Lead |
