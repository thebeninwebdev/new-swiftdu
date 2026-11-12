import { type NextRequest, NextResponse } from "next/server";
import { createAuthContinuation } from "@/lib/auth-continuation";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { next?: unknown } | null;
  const reference = await createAuthContinuation(
    typeof body?.next === "string" ? body.next : null,
  );

  if (!reference) {
    return NextResponse.json(
      { error: "Invalid destination" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { reference },
    { headers: { "Cache-Control": "no-store" } },
  );
}
