import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AnalyticsEventModel } from "@/models/analytics";

const DEFAULT_DAYS = 30;

type CountResult = {
  _id: string;
  count: number;
};

function normalizeLimit(value: string | null, fallback = 8) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), 20);
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("days")) || DEFAULT_DAYS, 1),
    365
  );
  const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const match = { createdAt: { $gte: since } };

  await connectDB();

  const [
    totalPageViews,
    uniqueVisitorResult,
    topCountries,
    topReferrers,
    topPages,
    trafficByDay,
    conversionEvents,
    deviceBreakdown,
    browserBreakdown,
  ] = await Promise.all([
    AnalyticsEventModel.countDocuments({ ...match, eventType: "page_view" }),
    AnalyticsEventModel.distinct("visitorId", match),
    AnalyticsEventModel.aggregate<CountResult>([
      { $match: match },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountResult>([
      { $match: match },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountResult>([
      { $match: { ...match, eventType: "page_view" } },
      { $group: { _id: "$page", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<{ _id: string; pageViews: number; uniqueVisitors: string[] }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          pageViews: {
            $sum: { $cond: [{ $eq: ["$eventType", "page_view"] }, 1, 0] },
          },
          uniqueVisitors: { $addToSet: "$visitorId" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AnalyticsEventModel.aggregate<CountResult>([
      { $match: { ...match, eventType: { $ne: "page_view" } } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountResult>([
      { $match: match },
      { $group: { _id: "$device", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEventModel.aggregate<CountResult>([
      { $match: match },
      { $group: { _id: "$browser", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
  ]);

  return NextResponse.json({
    range: { days, since },
    totalPageViews,
    uniqueVisitors: uniqueVisitorResult.length,
    topCountries: topCountries.map((item) => ({ label: item._id || "Unknown", count: item.count })),
    topReferralSources: topReferrers.map((item) => ({ label: item._id || "Direct", count: item.count })),
    topPages: topPages.map((item) => ({ label: item._id || "/", count: item.count })),
    trafficChart: trafficByDay.map((item) => ({
      date: item._id,
      pageViews: item.pageViews,
      uniqueVisitors: item.uniqueVisitors.length,
    })),
    conversionEvents: conversionEvents.map((item) => ({ label: item._id, count: item.count })),
    deviceBreakdown: deviceBreakdown.map((item) => ({ label: item._id || "Unknown", count: item.count })),
    browserBreakdown: browserBreakdown.map((item) => ({ label: item._id || "Unknown", count: item.count })),
  });
}
