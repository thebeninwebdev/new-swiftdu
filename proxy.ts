import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { EXCO_DASHBOARD_PATHS, getExcoDashboardPath } from '@/lib/exco-constants';

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

const EXCO_DASHBOARD_ROUTES = Object.values(EXCO_DASHBOARD_PATHS);

function getDefaultRouteForRole(role?: string | null, excoRole?: string | null) {
  const excoDashboardPath = getExcoDashboardPath(excoRole);
  if (excoDashboardPath) return excoDashboardPath;

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
  const excoRole = (user as { excoRole?: string | null } | undefined)?.excoRole;
  const defaultRoute = getDefaultRouteForRole(role, excoRole);
  const isExcoDashboardRoute = EXCO_DASHBOARD_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );

  if (pathname === '/' && user) {
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  if (isPublicRoute) {
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

  if (isExcoDashboardRoute) {
    return NextResponse.next();
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
    // '/about-us',
    // '/contact-us',
    // '/login',
    // '/password/:path*',
    // '/reset-password',
    // '/signup',
    // '/terms',
    '/dashboard/:path*',
    '/tasker-dashboard/:path*',
    '/cfo-dashboard/:path*',
    '/cmo-dashboard/:path*',
    '/coo-dashboard/:path*',
    '/cto-dashboard/:path*',
    '/admin/:path*',
  ],
};
