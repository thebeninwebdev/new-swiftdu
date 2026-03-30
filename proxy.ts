import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {headers} from "next/headers"
import {auth} from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth.api.getSession({
    headers: await headers()
  });
  const user = session?.user;

  // If not logged in, redirect to login
  if (!user) {
        console.log(session)
    return NextResponse.redirect(new URL('/login', request.url));

  }

  // Role-based access control
  if (pathname.startsWith('/admin')) {
    if (user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else if (pathname.startsWith('/tasker-dashboard')) {
    if (user.role !== 'tasker') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else if (pathname.startsWith('/dashboard')) {
    if (user.role !== 'user' && user.role !== 'tasker') {
        console.log(user.role)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/tasker-dashboard/:path*', '/admin/:path*'],
};
