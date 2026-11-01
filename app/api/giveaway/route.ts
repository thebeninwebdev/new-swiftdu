import { NextResponse } from "next/server";
import { getGiveaway, serializeGiveaway } from "@/lib/giveaway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = serializeGiveaway(await getGiveaway());
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Giveaway state is temporarily unavailable." },
      { status: 503 },
    );
  }
}
