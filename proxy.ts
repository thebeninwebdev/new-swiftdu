import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { areOperationsEnabled } from '@/lib/operations';
import { EXCO_DASHBOARD_PATHS, normalizeExcoRole } from '@/lib/exco-constants';

const PUBLIC_ROUTES = [
  '/businesses',
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

const SUSPENSION_EXEMPT_ROUTES = [
  '/auth',
  '/login',
  '/password',
  '/password/reset',
  '/reset-password',
  '/signup',
  '/complete-profile',
  '/tasker-signup',
  '/offline',
  '/suspended',
];

function matchesRoute(pathname: string, route: string) {
  return route === '/' ? pathname === '/' : pathname.startsWith(route);
}

const EXCO_DASHBOARD_ROUTES = Object.values(EXCO_DASHBOARD_PATHS);
export function getTaskerDashboardRouteForRole(role?: string | null, excoRole?: string | null) {
  if (role === 'tasker') return null;
  if (role === 'admin' || normalizeExcoRole(excoRole)) return '/admin';
  return '/tasker-signup';
}
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

  // Public, session-independent fallback, including during suspension.
  if (pathname === '/offline') return NextResponse.next();

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

  const isPublicRoute = PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route));
  const isSuspensionExemptRoute = SUSPENSION_EXEMPT_ROUTES.some((route) =>
    matchesRoute(pathname, route)
  );

  // Public pages must remain available even when the auth database is down.
  // Importing lib/auth initializes its MongoDB client, so load it only after
  // public routes have been handled.
  if (isPublicRoute) {
    if (!operationsEnabled && !isSuspensionExemptRoute) {
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
    // Never bounce a prospective or stale tasker through the customer home page:
    // when operations are paused that page redirects to /suspended and hides the
    // actual account/onboarding problem. Admins retain their existing workspace.
    if (role !== 'admin' && !normalizedExcoRole && user.id) {
      try {
        const { reconcileTaskerIdentityForUser } = await import('@/lib/tasker-onboarding');
        const repaired = await reconcileTaskerIdentityForUser(user.id);
        if (repaired) return NextResponse.next();
      } catch {
        // A conflicting or otherwise ambiguous record must go through the
        // existing onboarding/reapplication path rather than be overwritten.
      }
    }
    const taskerRoute = getTaskerDashboardRouteForRole(role, excoRole)!;
    return NextResponse.redirect(new URL(taskerRoute, request.url));
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
