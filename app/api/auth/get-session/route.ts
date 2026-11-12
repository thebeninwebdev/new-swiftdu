import { auth } from "@/lib/auth";
import { SESSION_RESPONSE_HEADERS } from "@/lib/auth-session-config";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";


export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return NextResponse.json(session, { headers: SESSION_RESPONSE_HEADERS });
}

export const POST = GET;
