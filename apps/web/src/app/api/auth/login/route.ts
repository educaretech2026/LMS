import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getInternalApiUrl,
  getAuthCookieName,
  getAuthCookieOptions,
  isRequestSecure,
  validateCsrf,
} from '@/lib/bff-config';

export async function POST(request: NextRequest) {
  // CSRF validation
  const csrfResult = validateCsrf(request);
  if (!csrfResult.valid) {
    return NextResponse.json(
      { success: false, message: csrfResult.reason || 'CSRF validation failed' },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return NextResponse.json(
      { success: false, message: 'Email and password are required' },
      { status: 400 }
    );
  }

  let internalApiUrl: string;
  try {
    internalApiUrl = getInternalApiUrl();
  } catch (configErr: any) {
    console.error('BFF Configuration Error:', configErr?.message || configErr);
    return NextResponse.json(
      { success: false, message: 'Authentication service configuration error' },
      { status: 500 }
    );
  }

  try {
    const upstreamRes = await fetch(`${internalApiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const upstreamData = await upstreamRes.json().catch(() => ({}));

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: upstreamData.message || 'Authentication failed',
        },
        { status: upstreamRes.status }
      );
    }

    const rawToken = upstreamData.access_token || upstreamData.accessToken;
    if (!rawToken) {
      return NextResponse.json(
        { success: false, message: 'Authentication service did not issue a token' },
        { status: 502 }
      );
    }

    const isHttps = isRequestSecure(request);
    const cookieName = getAuthCookieName(isHttps);
    const cookieOptions = getAuthCookieOptions(isHttps);

    // Build client response: NEVER include raw JWT in response body!
    const clientResponse = NextResponse.json({
      success: true,
      user: upstreamData.user,
    });

    // Set HttpOnly SameSite=Lax cookie (host-only __Host-AccessToken if HTTPS)
    clientResponse.cookies.set(cookieName, rawToken, cookieOptions);

    // When on HTTPS, clear legacy plain cookie to avoid cookie shadowing
    if (isHttps) {
      clientResponse.cookies.set('AccessToken', '', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }

    return clientResponse;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'Authentication service temporarily unavailable',
      },
      { status: 503 }
    );
  }
}
