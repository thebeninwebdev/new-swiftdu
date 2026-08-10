import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { EXCO_DASHBOARD_PATHS, getExcoDashboardPath } from '@/lib/exco-constants';
import {
  buildCompleteProfilePath,
  getSafeNextPath,
  isProfileComplete,
} from '@/lib/profile-completion';

const PUBLIC_ROUTES = [
  '/',
  '/about-us',
  '/contact-us',
  '/login',
  '/operations-suspended',
  '/password',
  '/password/reset',
  '/reset-password',
  '/signup',
  '/tasker-signup',
  '/tasker/onboarding',
  '/terms',
];

const EXCO_DASHBOARD_ROUTES = Object.values(EXCO_DASHBOARD_PATHS);
const AUTH_ROUTES = ['/login', '/signup'];
const OPERATIONS_SUSPENDED_PATH = '/operations-suspended';

function isTaskerSignupRoute(pathname: string) {
  return pathname === '/tasker-signup' || pathname.startsWith('/tasker-signup/');
}

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

  if (
    pathname !== OPERATIONS_SUSPENDED_PATH &&
    !isTaskerSignupRoute(pathname)
  ) {
    return NextResponse.redirect(
      new URL(OPERATIONS_SUSPENDED_PATH, request.url)
    );
  }

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
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (user && (pathname === '/' || isAuthRoute)) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
    const safeCallbackUrl = isAuthRoute ? getSafeNextPath(callbackUrl) : null;
    const nextRoute = isProfileComplete(user)
      ? safeCallbackUrl ?? defaultRoute
      : buildCompleteProfilePath(safeCallbackUrl);
    return NextResponse.redirect(new URL(nextRoute, request.url));
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

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

  if (!isProfileComplete(user)) {
    return NextResponse.redirect(
      new URL(buildCompleteProfilePath(currentPath), request.url)
    );
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
