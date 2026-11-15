import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { areOperationsEnabled } from '@/lib/operations';
import { EXCO_DASHBOARD_PATHS, normalizeExcoRole } from '@/lib/exco-constants';
import { getSignedInDestination } from '@/lib/profile-completion';

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
type ProxySession = {
  user?: { id?: string; role?: string | null; excoRole?: string | null } | null;
} | null;

async function loadProxySession(headers: Headers): Promise<ProxySession> {
  const { auth } = await import('@/lib/auth');
  return auth.api.getSession({ headers });
}

/**
 * Netlify runs Next.js proxy through an Edge Function, where importing the
 * MongoDB-backed Better Auth instance is not supported reliably. The existing
 * same-origin server route handles full session verification in Node.js.
 * Never trust a cookie alone; malformed or unavailable responses fail closed.
 */
export async function loadNetlifyProxySession(request: NextRequest): Promise<ProxySession> {
  const url = new URL('/api/auth/get-session', request.url);
  const cookie = request.headers.get('cookie');
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Session API returned HTTP ${response.status}`);
  }
  const result: unknown = await response.json();
  if (result === null) return null;
  if (typeof result !== 'object' || !result || !('user' in result)) {
    throw new Error('Session API returned an invalid response');
  }
  const user = (result as { user?: unknown }).user;
  if (user === null) return null;
  if (!user || typeof user !== 'object' ||
      typeof (user as { id?: unknown }).id !== 'string' ||
      !(user as { id: string }).id) {
    throw new Error('Session API returned an invalid user');
  }
  return result as ProxySession;
}

export function getTaskerDashboardRouteForRole(role?: string | null, excoRole?: string | null) {
  if (role === 'tasker') return null;
  if (role === 'admin' || normalizeExcoRole(excoRole)) return '/admin';
  return '/tasker-signup';
}
export async function handleProxy(
  request: NextRequest,
  getSession: (headers: Headers) => Promise<ProxySession>,
) {
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

  let session;
  try {
    session = await getSession(request.headers);
  } catch (error) {
    console.error('[auth:proxy]', {
      code: 'session_verification_unavailable',
      pathname,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return new NextResponse('Unable to verify your session. Please retry.', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '5' },
    });
  }

  const user = session?.user;
  const role = user?.role ?? 'user';
  const excoRole = (user as { excoRole?: string | null } | undefined)?.excoRole;
  const normalizedExcoRole = normalizeExcoRole(excoRole);
  const defaultRoute = getSignedInDestination(user);
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

export async function proxy(request: NextRequest) {
  // Netlify's proxy runs at the edge; MongoDB session validation must run
  // in the Node.js API route. Vercel and local deployments retain their
  // existing direct Better Auth session validation.
  if (process.env.NETLIFY === 'true') {
    return handleProxy(request, () => loadNetlifyProxySession(request));
  }
  return handleProxy(request, loadProxySession);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
