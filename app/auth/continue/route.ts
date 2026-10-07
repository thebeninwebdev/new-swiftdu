import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthBaseUrl } from "@/lib/site";
import { getPostAuthRedirect, getSafeNextPath } from "@/lib/profile-completion";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (!session?.user) {
    const authUrl = new URL("/auth", getAuthBaseUrl());
    if (nextPath) authUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.redirect(
    new URL(getPostAuthRedirect(session.user, nextPath), getAuthBaseUrl())
  );
}
