/**
 * Backend-for-Frontend (BFF) Configuration and Security Helpers
 *
 * Enforces host-only HttpOnly cookies, CSRF protection, route allowlisting,
 * traversal prevention, and upstream API base URL containment.
 */

/**
 * Resolves the internal API base URL.
 * In production, fails closed if INTERNAL_API_URL is missing or invalid.
 * Never silently falls back to localhost in production.
 */
export function getInternalApiUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (isProduction ? 'https://api.educarelearning.in/api' : 'http://localhost:3001/api');

  if (isProduction) {
    if (!configured || !configured.trim()) {
      throw new Error(
        'FATAL: INTERNAL_API_URL or NEXT_PUBLIC_API_URL is mandatory in production for secure BFF upstream proxying.'
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch (e: any) {
      throw new Error(`FATAL: Resolved internal API URL is not valid: ${e?.message || e}`);
    }
    // Production requires valid HTTP/HTTPS scheme and valid host
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      throw new Error('FATAL: Internal API URL must use HTTPS protocol in production.');
    }
    return configured.trim().replace(/\/+$/, '');
  }

  // Development mode fallback
  return configured.trim().replace(/\/+$/, '');
}

export const INTERNAL_API_URL = (function () {
  try {
    return getInternalApiUrl();
  } catch {
    // If running during early module load in tests or production without env,
    // export empty string and let route handlers call getInternalApiUrl() dynamically
    return '';
  }
})();

/**
 * Determines cookie name based on environment and protocol.
 * In production, strictly returns '__Host-AccessToken'.
 * In non-production, falls back to 'AccessToken' only if not HTTPS.
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
    maxAge: 7 * 24 * 60 * 60, // 7 days matching JWT expiration
    // Domain is explicitly undefined for RFC 6265bis __Host- cookie host-only binding
    domain: undefined,
  };
}

/**
 * Extracts authenticated JWT token from request cookies.
 * In production, strictly accepts ONLY '__Host-AccessToken'.
 * The legacy 'AccessToken' cookie is rejected in production to eliminate cookie shadowing.
 */
export function extractTokenFromRequest(
  request: Request | { cookies?: { get: (name: string) => { value: string } | undefined } }
): string | undefined {
  const isProduction = process.env.NODE_ENV === 'production';

  if ('cookies' in request && request.cookies && typeof request.cookies.get === 'function') {
    const hostToken = request.cookies.get('__Host-AccessToken')?.value;
    if (hostToken) return hostToken;

    // Reject legacy cookie in production
    if (!isProduction) {
      const legacyToken = request.cookies.get('AccessToken')?.value;
      if (legacyToken) return legacyToken;
    }
    return undefined;
  }

  const cookieHeader = (request as Request).headers?.get('cookie') || '';
  const hostMatch = cookieHeader.match(/(?:^|;\s*)__Host-AccessToken=([^;]+)/);
  if (hostMatch) return hostMatch[1];

  if (!isProduction) {
    const legacyMatch = cookieHeader.match(/(?:^|;\s*)AccessToken=([^;]+)/);
    if (legacyMatch) return legacyMatch[1];
  }

  return undefined;
}

/**
 * CSRF Validation for Cookie-Authenticated Mutations
 *
 * Implements OWASP CSRF Prevention recommendations:
 * 1. Safe methods (GET, HEAD, OPTIONS) do not mutate state.
 * 2. Sec-Fetch-Site metadata: rejects 'cross-site' requests.
 * 3. Origin header: validated against explicit canonical configuration.
 *    Does NOT trust incoming Host or request.url in production.
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

  const cleanOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`.toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';

  // Explicit canonical origins: Never trust incoming Host header in production!
  const canonicalOrigins = [
    'https://lms.educarelearning.in',
    'https://educarelearning.in',
    'https://api.educarelearning.in',
    ...(process.env.APP_ENV === 'staging'
      ? ['https://staging.educarelearning.in', 'https://staging-api.educarelearning.in']
      : []),
  ];

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      canonicalOrigins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin.toLowerCase());
    } catch {}
  }
  if (process.env.APP_URL) {
    try {
      canonicalOrigins.push(new URL(process.env.APP_URL).origin.toLowerCase());
    } catch {}
  }

  const allowedOrigins = isProduction
    ? Array.from(new Set(canonicalOrigins))
    : Array.from(
        new Set([
          ...canonicalOrigins,
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
        ])
      );

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
  'audit-logs',
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

/**
 * Validates API path against allowlist, path traversal, encoded separators,
 * double-encoding, and privileged route restrictions.
 */
export function validateApiPath(
  pathSegments: string[]
): { valid: boolean; normalizedPath?: string; reason?: string } {
  if (!pathSegments || pathSegments.length === 0) {
    return { valid: false, reason: 'Empty API route path' };
  }

  const sanitizedSegments: string[] = [];

  for (const rawSegment of pathSegments) {
    if (!rawSegment || rawSegment === '.' || rawSegment === '..') {
      return { valid: false, reason: 'Path traversal attempt detected' };
    }

    if (rawSegment.includes('/') || rawSegment.includes('\\') || rawSegment.includes('\0')) {
      return { valid: false, reason: 'Illegal separator or null byte in path segment' };
    }

    // Iteratively decode to catch multi-layered / double percent encoding (%252e%252e)
    let current = rawSegment;
    for (let i = 0; i < 3; i++) {
      try {
        const decoded = decodeURIComponent(current);
        if (decoded === current) break;
        current = decoded;
        if (
          current === '.' ||
          current === '..' ||
          current.includes('..') ||
          current.includes('/') ||
          current.includes('\\') ||
          current.includes('\0')
        ) {
          return { valid: false, reason: 'Decoded path traversal or illegal character detected' };
        }
      } catch {
        return { valid: false, reason: 'Malformed percent-encoding in path segment' };
      }
    }

    sanitizedSegments.push(current);
  }

  const topPrefix = sanitizedSegments[0]?.toLowerCase();
  if (!ALLOWED_API_PREFIXES.includes(topPrefix as any)) {
    return { valid: false, reason: `API route prefix '${topPrefix}' is not authorized` };
  }

  // Privileged route protection: forbid calling login/logout through the generic proxy
  if (topPrefix === 'auth') {
    const subRoute = sanitizedSegments[1]?.toLowerCase();
    if (['login', 'logout', 'logout-all'].includes(subRoute)) {
      return {
        valid: false,
        reason: `Route '/auth/${subRoute}' must be accessed via dedicated '/api/auth/${subRoute}' handler`,
      };
    }
  }

  return { valid: true, normalizedPath: '/' + sanitizedSegments.join('/') };
}
