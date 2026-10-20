/**
 * Backend-for-Frontend (BFF) Configuration and Security Helpers
 *
 * Enforces host-only HttpOnly cookies, CSRF protection, route allowlisting,
 * and upstream API base URL containment.
 */

export const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001/api'
).replace(/\/+$/, '');

/**
 * Determines cookie name based on environment and protocol.
 * RFC 6265bis mandates that cookies with the `__Host-` prefix MUST:
 * 1. Be set with `Secure`
 * 2. Be set from a secure origin (HTTPS)
 * 3. Have `Path=/`
 * 4. NOT contain a `Domain` attribute
 *
 * For local HTTP development, browsers will reject `__Host-` prefix cookies.
 * We safely fall back to `AccessToken` on non-HTTPS development without weakening
 * production requirements.
 */
export function getAuthCookieName(isHttps: boolean): string {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction || isHttps ? '__Host-AccessToken' : 'AccessToken';
}

export function getAuthCookieOptions(isHttps: boolean) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction || isHttps;
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    // Crucial: No domain attribute is set, ensuring host-only binding
  };
}

export function extractTokenFromRequest(
  request: Request | { cookies?: { get: (name: string) => { value: string } | undefined } }
): string | undefined {
  if ('cookies' in request && request.cookies && typeof request.cookies.get === 'function') {
    const hostToken = request.cookies.get('__Host-AccessToken')?.value;
    if (hostToken) return hostToken;
    const legacyToken = request.cookies.get('AccessToken')?.value;
    if (legacyToken) return legacyToken;
  }

  const cookieHeader = (request as Request).headers?.get('cookie') || '';
  const hostMatch = cookieHeader.match(/(?:^|;\s*)__Host-AccessToken=([^;]+)/);
  if (hostMatch) return hostMatch[1];
  const legacyMatch = cookieHeader.match(/(?:^|;\s*)AccessToken=([^;]+)/);
  if (legacyMatch) return legacyMatch[1];
  return undefined;
}

/**
 * CSRF Validation for Cookie-Authenticated Mutations
 *
 * Implements OWASP CSRF Prevention recommendations:
 * 1. Safe methods (GET, HEAD, OPTIONS) do not mutate state.
 * 2. Sec-Fetch-Site metadata: rejects 'cross-site' requests.
 * 3. Origin header: must match configured web origin exactly.
 *    Missing Origin on browser mutation fails closed with 403.
 */
export function validateCsrf(request: Request): { valid: boolean; reason?: string } {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite === 'cross-site') {
    return { valid: false, reason: 'Cross-site mutation rejected by Sec-Fetch-Site' };
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    return { valid: false, reason: 'Missing Origin header on state-changing request' };
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return { valid: false, reason: 'Malformed Origin header' };
  }

  const cleanOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`;
  const requestUrl = new URL(request.url);
  const currentOrigin = `${requestUrl.protocol}//${requestUrl.host}`;

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : null;

  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    currentOrigin,
    configuredAppUrl,
    !isProduction ? 'http://localhost:3000' : null,
    !isProduction ? 'http://127.0.0.1:3000' : null,
  ].filter(Boolean) as string[];

  if (!allowedOrigins.includes(cleanOrigin)) {
    return { valid: false, reason: `Origin ${cleanOrigin} is not in trusted origin list` };
  }

  return { valid: true };
}

/**
 * Strict Route Allowlist for BFF API Proxying
 */
export const ALLOWED_API_PREFIXES = [
  'assignments',
  'attendance',
  'auth',
  'centres',
  'courses',
  'doubts',
  'enquiry',
  'estudy',
  'exams',
  'fee',
  'finance',
  'forms',
  'live-class',
  'notices',
  'notifications',
  'permissions',
  'public',
  'report',
  'roles',
  'setup',
  'sms',
  'staff',
  'storage',
  'students',
  'study-materials',
  'support',
  'syllabus',
  'users',
] as const;

export function validateApiPath(
  pathSegments: string[]
): { valid: boolean; normalizedPath?: string; reason?: string } {
  if (!pathSegments || pathSegments.length === 0) {
    return { valid: false, reason: 'Empty API route path' };
  }

  for (const segment of pathSegments) {
    if (segment === '..' || segment === '.' || segment.includes('/') || segment.includes('\\')) {
      return { valid: false, reason: 'Path traversal attempt detected' };
    }
    try {
      const decoded = decodeURIComponent(segment);
      if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) {
        return { valid: false, reason: 'Encoded path traversal attempt detected' };
      }
    } catch {
      return { valid: false, reason: 'Malformed URL encoding in path segment' };
    }
  }

  const topPrefix = pathSegments[0];
  if (!ALLOWED_API_PREFIXES.includes(topPrefix as any)) {
    return { valid: false, reason: `API route prefix '${topPrefix}' is not authorized` };
  }

  return { valid: true, normalizedPath: '/' + pathSegments.join('/') };
}
