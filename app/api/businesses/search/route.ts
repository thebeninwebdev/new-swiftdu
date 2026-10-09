import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  searchBusinesses,
  validateBusinessSearchQuery,
} from "@/lib/business-search";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(req: NextRequest) {
  let query: string;
  try {
    query = validateBusinessSearchQuery(req.nextUrl.searchParams.get("q"));
  } catch {
    return NextResponse.json(
      { error: "Enter what you need (2–200 characters)." },
      { status: 400 },
    );
  }
  try {
    await connectDB();
    return NextResponse.json(
      { businesses: await searchBusinesses(query) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[business search] Directory unavailable.");
    return NextResponse.json(
      { error: "Search could not load. Please try again." },
      { status: 503 },
    );
  }
}
