import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('AccessToken')?.value;
  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  const publicPaths = ['/login', '/admission', '/api/'];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) || pathname.startsWith('/_next/') || pathname.includes('.');

  if (!token && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && pathname === '/login') {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
