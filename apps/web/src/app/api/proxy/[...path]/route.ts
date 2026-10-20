import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getInternalApiUrl,
  extractTokenFromRequest,
  validateCsrf,
  validateApiPath,
} from '@/lib/bff-config';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const ALLOWED_HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'];

async function handleProxy(request: NextRequest, context: RouteContext) {
  const method = request.method.toUpperCase();

  // 1. Method Authorization Check
  if (!ALLOWED_HTTP_METHODS.includes(method)) {
    return NextResponse.json(
      { success: false, message: `HTTP method ${method} not allowed` },
      { status: 405 }
    );
  }

  // 2. CSRF validation for state-changing methods
  const csrfResult = validateCsrf(request);
  if (!csrfResult.valid) {
    return NextResponse.json(
      { success: false, message: csrfResult.reason || 'CSRF validation failed' },
      { status: 403 }
    );
  }

  // 3. Validate API path against strict allowlist, traversal, and sensitive routes
  const { path } = await context.params;
  const pathValidation = validateApiPath(path);
  if (!pathValidation.valid || !pathValidation.normalizedPath) {
    return NextResponse.json(
      { success: false, message: pathValidation.reason || 'Forbidden API path' },
      { status: 403 }
    );
  }

  // 4. Extract authenticated token from HttpOnly cookie (strictly __Host- in prod)
  const token = extractTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Authentication required' },
      { status: 401 }
    );
  }

  // 5. Construct upstream destination URL safely
  let internalApiUrl: string;
  try {
    internalApiUrl = getInternalApiUrl();
  } catch (configErr: any) {
    console.error('BFF Configuration Error:', configErr?.message || configErr);
    return NextResponse.json(
      { success: false, message: 'Server configuration error' },
      { status: 500 }
    );
  }

  const search = request.nextUrl.search || '';
  const upstreamUrl = `${internalApiUrl}${pathValidation.normalizedPath}${search}`;

  // 6. Build sanitized upstream request headers
  // Never forward client-supplied Authorization or Cookie headers
  const forwardHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: request.headers.get('accept') || 'application/json',
  };

  const contentType = request.headers.get('content-type');
  if (contentType) {
    forwardHeaders['Content-Type'] = contentType;
  }

  // Read request body for mutations
  let body: BodyInit | null = null;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    try {
      body = await request.arrayBuffer();
    } catch {
      body = null;
    }
  }

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method,
      headers: forwardHeaders,
      body,
    });

    const resContentType = upstreamRes.headers.get('content-type') || '';
    const resData = await upstreamRes.arrayBuffer();

    const clientRes = new NextResponse(resData, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
    });

    if (resContentType) {
      clientRes.headers.set('content-type', resContentType);
    }

    // If upstream indicates session expired/invalid, clear auth cookie
    if (upstreamRes.status === 401) {
      const isHttps =
        request.nextUrl.protocol === 'https:' ||
        request.headers.get('x-forwarded-proto') === 'https';
      const isProduction = process.env.NODE_ENV === 'production';
      const secure = isProduction || isHttps;

      clientRes.cookies.set('__Host-AccessToken', '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });

      if (!isProduction) {
        clientRes.cookies.set('AccessToken', '', {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        });
      }
    }

    return clientRes;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Upstream service communication failed' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}
