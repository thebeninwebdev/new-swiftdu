import { auth } from "@/lib/auth";
import { SESSION_RESPONSE_HEADERS } from "@/lib/auth-session-config";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";


export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    return NextResponse.json(session, { headers: SESSION_RESPONSE_HEADERS });
  } catch (error) {
    console.error('[auth:get-session]', {
      code: 'session_request_failed',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'Session verification is temporarily unavailable.' },
      { status: 503, headers: { ...SESSION_RESPONSE_HEADERS, 'Retry-After': '5' } },
    );
  }
}

export const POST = GET;
