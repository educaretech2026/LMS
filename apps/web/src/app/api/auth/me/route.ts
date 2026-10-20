import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getInternalApiUrl, extractTokenFromRequest } from '@/lib/bff-config';

export async function GET(request: NextRequest) {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
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
