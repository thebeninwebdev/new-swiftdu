import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { areOperationsEnabled, isCustomerOperationRoute } from '@/lib/operations';
import { EXCO_DASHBOARD_PATHS, normalizeExcoRole } from '@/lib/exco-constants';

const PUBLIC_ROUTES = [
  '/',
  '/about-us',
  '/contact-us',
  '/auth',
  '/login',
  '/password',
  '/password/reset',
  '/reset-password',
  '/signup',
  '/complete-profile',
  '/tasker-signup',
  '/terms',
];

const EXCO_DASHBOARD_ROUTES = Object.values(EXCO_DASHBOARD_PATHS);
function getDefaultRouteForRole(role?: string | null, excoRole?: string | null) {
  if (normalizeExcoRole(excoRole)) return '/admin';

  switch (role) {
    case 'admin':
      return '/admin';
    case 'tasker':
      return '/tasker-dashboard';
    case 'user':
    default:
      return '/';
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const currentPath = `${pathname}${search}`;

  const operationsEnabled = areOperationsEnabled();

  // Customer ordering is paused, but authentication and authorized internal setup remain available.
  if (!operationsEnabled && pathname === '/suspended') {
    return NextResponse.next();
  }

  if (operationsEnabled && pathname === '/suspended') {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );

  // Public pages must remain available even when the auth database is down.
  // Importing lib/auth initializes its MongoDB client, so load it only after
  // public routes have been handled.
  if (isPublicRoute) {
    if (!operationsEnabled && isCustomerOperationRoute(pathname)) {
      const response = NextResponse.redirect(new URL('/suspended', request.url));
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    return NextResponse.next();
  }

  const { auth } = await import('@/lib/auth');
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const user = session?.user;
  const role = user?.role ?? 'user';
  const excoRole = (user as { excoRole?: string | null } | undefined)?.excoRole;
  const normalizedExcoRole = normalizeExcoRole(excoRole);
  const defaultRoute = getDefaultRouteForRole(role, excoRole);
  const isExcoDashboardRoute = EXCO_DASHBOARD_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!user) {
    const authUrl = new URL('/auth', request.url);
    authUrl.searchParams.set('next', currentPath);
    return NextResponse.redirect(authUrl);
  }

  if (pathname.startsWith('/admin') && role !== 'admin' && !normalizedExcoRole) {
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

  if (!operationsEnabled && isCustomerOperationRoute(pathname)) {
    const response = NextResponse.redirect(new URL('/suspended', request.url));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
