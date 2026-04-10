import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const PUBLIC_ROUTES = [
  '/',
  '/about-us',
  '/contact-us',
  '/login',
  '/password',
  '/password/reset',
  '/reset-password',
  '/signup',
  '/terms',
];

function getDefaultRouteForRole(role?: string | null) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'tasker':
      return '/dashboard';
    case 'user':
    default:
      return '/dashboard';
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const user = session?.user;
  const role = user?.role ?? 'user';
  const defaultRoute = getDefaultRouteForRole(role);

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );

  if (isPublicRoute) {
    if (user) {
      return NextResponse.redirect(new URL(defaultRoute, request.url));
    }

    return NextResponse.next();
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  if (pathname.startsWith('/tasker-dashboard') && role !== 'tasker') {
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  if (
    pathname.startsWith('/dashboard') &&
    role !== 'user' &&
    role !== 'tasker'
  ) {
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/about-us',
    '/contact-us',
    '/login',
    '/password/:path*',
    '/reset-password',
    '/signup',
    '/terms',
    '/dashboard/:path*',
    '/tasker-dashboard/:path*',
    '/admin/:path*',
  ],
};
