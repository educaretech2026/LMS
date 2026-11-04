import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getInternalApiUrl, extractTokenFromRequest, isRequestSecure } from '@/lib/bff-config';

export async function GET(request: NextRequest) {
  const token = extractTokenFromRequest(request);
  if (!token) {
    // Unauthenticated query is a normal state (not an error), return 200 to prevent red 401 in DevTools console
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
  }

  let internalApiUrl: string;
  try {
    internalApiUrl = getInternalApiUrl();
  } catch {
    return NextResponse.json(
      { authenticated: false, message: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const upstreamRes = await fetch(`${internalApiUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!upstreamRes.ok) {
      // If token expired or invalid, upstream returns 401. Treat as unauthenticated and clear expired cookies.
      if (upstreamRes.status === 401) {
        const isHttps = isRequestSecure(request);
        const res = NextResponse.json(
          { authenticated: false, user: null },
          { status: 200 }
        );
        res.cookies.set('__Host-AccessToken', '', {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        });
        res.cookies.set('AccessToken', '', {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        });
        return res;
      }

      return NextResponse.json(
        { authenticated: false, user: null },
        { status: upstreamRes.status }
      );
    }

    const user = await upstreamRes.json();
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json(
      { authenticated: false, message: 'Upstream user service unavailable' },
      { status: 503 }
    );
  }
}
