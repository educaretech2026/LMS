import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const token = request.cookies.get('AccessToken');
  
  // Public routes that don't require authentication
  const isPublicRoute = 
    request.nextUrl.pathname === '/login' || 
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname.startsWith('/admission') ||
    request.nextUrl.pathname.startsWith('/f/') ||
    request.nextUrl.pathname.startsWith('/public');

  if (!token && !isPublicRoute) {
    // Redirect unauthenticated users to the login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublicRoute) {
    // Redirect authenticated users trying to access login/signup to the dashboard
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
