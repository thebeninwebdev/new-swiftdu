import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AnalyticsEventModel } from "@/models/analytics";
import {
  getRequestIpAddress,
  getRequestLocation,
  isBotUserAgent,
  isProductionAnalyticsRequest,
  normalizePage,
  normalizeReferrer,
  parseUserAgent,
  shouldSkipAnalyticsPath,
} from "@/lib/analytics/server";

const DUPLICATE_WINDOW_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 30;

type TrackBody = {
  visitorId?: string;
  page?: string;
  referrer?: string;
  eventName?: string;
};

function skipped(reason: string, status = 202) {
  return NextResponse.json({ tracked: false, reason }, { status });
}

export async function POST(request: NextRequest) {
  if (!isProductionAnalyticsRequest(request)) {
    return skipped("analytics_disabled");
  }

  const userAgent = request.headers.get("user-agent") || "";
  if (isBotUserAgent(userAgent)) {
    return skipped("bot_filtered");
  }

  let body: TrackBody;
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return skipped("invalid_json", 400);
  }

  const visitorId = body.visitorId?.trim();
  if (!visitorId) {
    return skipped("missing_visitor_id", 400);
  }

  const page = normalizePage(body.page || "/");
  const pathname = page.split("?")[0] || "/";
  if (shouldSkipAnalyticsPath(pathname)) {
    return skipped("internal_path");
  }

  const eventType = body.eventName?.trim().slice(0, 80) || "page_view";
  const ipAddress = getRequestIpAddress(request);
  const { country, city } = getRequestLocation(request);
  const { browser, os, device } = parseUserAgent(userAgent);
  const now = new Date();
  const duplicateSince = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
  const rateLimitSince = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  await connectDB();

  const recentDuplicate = await AnalyticsEventModel.exists({
    visitorId,
    page,
    eventType,
    createdAt: { $gte: duplicateSince },
  });

  if (recentDuplicate) {
    return skipped("duplicate_window");
  }

  const recentEventCount = await AnalyticsEventModel.countDocuments({
    $or: [{ visitorId }, { ipAddress }],
    createdAt: { $gte: rateLimitSince },
  });

  if (recentEventCount >= MAX_EVENTS_PER_WINDOW) {
    return skipped("rate_limited", 429);
  }

  await AnalyticsEventModel.create({
    visitorId,
    page,
    referrer: normalizeReferrer(body.referrer),
    country,
    city,
    ipAddress,
    browser,
    os,
    device,
    eventType,
    createdAt: now,
  });

  const response = NextResponse.json({ tracked: true }, { status: 201 });
  response.cookies.set("swiftdu_visitor_id", visitorId, {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
