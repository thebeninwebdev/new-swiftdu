import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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
  '/complete-profile',
  '/tasker-signup',
  '/tasker/onboarding',
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
      return '/tasker-dashboard';
    case 'user':
    default:
      return '/dashboard';
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const currentPath = `${pathname}${search}`;

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );

  // Public pages must remain available even when the auth database is down.
  // Importing lib/auth initializes its MongoDB client, so load it only after
  // public routes have been handled.
  if (isPublicRoute) {
    return NextResponse.next();
  }

  const { auth } = await import('@/lib/auth');
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

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', currentPath);
    return NextResponse.redirect(loginUrl);
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
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
