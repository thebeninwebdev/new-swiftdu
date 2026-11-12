import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthBaseUrl } from "@/lib/site";
import { resolveAuthContinuation } from "@/lib/auth-continuation";
import { COMPLETE_PROFILE_PATH, getPostAuthRedirect } from "@/lib/profile-completion";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const reference = request.nextUrl.searchParams.get("continuation");

  if (!session?.user) {
    const authUrl = new URL("/auth", getAuthBaseUrl());
    if (reference) authUrl.searchParams.set("continuation", reference);
    const response = NextResponse.redirect(authUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const isNewUser = request.nextUrl.searchParams.get("new") === "1";
  if (isNewUser) {
    const destination = await resolveAuthContinuation(reference);
    const profileUrl = new URL(COMPLETE_PROFILE_PATH, getAuthBaseUrl());
    if (destination && reference) profileUrl.searchParams.set("continuation", reference);
    const response = NextResponse.redirect(profileUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const destination = await resolveAuthContinuation(reference, { consume: true });
  const response = NextResponse.redirect(
    new URL(getPostAuthRedirect(session.user, destination), getAuthBaseUrl()),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
