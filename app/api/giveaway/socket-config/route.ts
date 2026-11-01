import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveSocketUrl() {
  const configured =
    process.env.GIVEAWAY_SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!configured) return null;

  try {
    const url = new URL(configured);
    const developmentLocalhost =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !developmentLocalhost) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function GET() {
  const socketUrl = resolveSocketUrl();
  if (!socketUrl) {
    return NextResponse.json(
      {
        socketUrl: null,
        error: "Realtime server is not configured.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { socketUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
