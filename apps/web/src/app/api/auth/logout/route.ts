import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getInternalApiUrl,
  extractTokenFromRequest,
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

  const token = extractTokenFromRequest(request);

  if (token) {
    try {
      const internalApiUrl = getInternalApiUrl();
      await fetch(`${internalApiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to notify upstream API during logout:', err);
    }
  }

  const isHttps = isRequestSecure(request);

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear host-only cookie
  response.cookies.set('__Host-AccessToken', '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  // Clear legacy cookie
  response.cookies.set('AccessToken', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
