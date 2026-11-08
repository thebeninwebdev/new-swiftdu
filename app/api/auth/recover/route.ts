
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
  "better-auth.dont_remember",
  "__Secure-better-auth.dont_remember",
  "better-auth.state",
  "__Secure-better-auth.state",
  "better-auth.oauth_state",
  "__Secure-better-auth.oauth_state",
];

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  // Revoke the server-side session where possible.
  // Recovery must still work if that session is invalid.
  try {
    const { auth } = await import("@/lib/auth");
    await auth.api.signOut({ headers: request.headers });
  } catch {
    // Continue clearing invalid browser cookies.
  }

  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );

  const isSwiftDUHost = [
    "swiftdu.org",
    "www.swiftdu.org",
  ].includes(request.nextUrl.hostname);

  for (const name of AUTH_COOKIES) {
    const expired =
      `${name}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;

    // Remove host-only cookies.
    response.headers.append("Set-Cookie", expired);

    // Also remove cookies shared across SwiftDU subdomains.
    if (isSwiftDUHost) {
      response.headers.append(
        "Set-Cookie",
        `${expired}; Domain=swiftdu.org`
      );
    }
  }

  return response;
}
