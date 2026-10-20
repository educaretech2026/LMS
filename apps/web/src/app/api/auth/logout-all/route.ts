import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getInternalApiUrl,
  extractTokenFromRequest,
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

  const token = extractTokenFromRequest(request);

  if (token) {
    try {
      const internalApiUrl = getInternalApiUrl();
      await fetch(`${internalApiUrl}/auth/logout-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to notify upstream API during logout-all:', err);
    }
  }

  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https';
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction || isHttps;

  const response = NextResponse.json({
    success: true,
    message: 'Logged out of all devices successfully',
  });

  response.cookies.set('__Host-AccessToken', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  if (!isProduction) {
    response.cookies.set('AccessToken', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return response;
}
