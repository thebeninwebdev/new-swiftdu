import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return NextResponse.json(session);
}

export const POST = GET;
