import { NextResponse, type NextRequest } from "next/server";

import { getExcoAccess, normalizeExcoRole, type ExcoRole } from "@/lib/exco";
import { connectDB } from "@/lib/db";
import { AnalyticsEventModel } from "@/models/analytics";
import { Order } from "@/models/order";
import { Review } from "@/models/review";
import Tasker from "@/models/tasker";
import { User } from "@/models/user";

const DEFAULT_DAYS = 30;
const OUTSTANDING_SETTLEMENT_STATUSES = [
  "not_due",
  "pending",
  "initialized",
  "failed",
  "overdue",
] as const;

type CountDatum = {
  _id: string;
  count: number;
};

type MoneySummary = {
  _id: null;
  totalAmount: number;
  amount: number;
  serviceFee: number;
  platformFee: number;
  taskerFee: number;
  waterFee: number;
};

type DashboardCard = {
  label: string;
  value: number;
  format: "number" | "currency" | "percent" | "minutes";
  description: string;
};

type UnsettledTasker = {
  taskerId: string;
  taskerName: string;
  taskerEmail: string;
  taskerPhone: string;
  isSettlementSuspended: boolean;
  totalOutstanding: number;
  taskCount: number;
  overdueCount: number;
  oldestDueAt: string | null;
  latestCompletedAt: string | null;
  tasks: Array<{
    orderId: string;
    description: string;
    taskType: string;
    platformFee: number;
    settlementStatus: string;
    settlementDueAt: string | null;
    completedAt: string | null;
  }>;
};

type ActiveFinanceTask = {
  orderId: string;
  taskerId: string;
  taskerName: string;
  taskerEmail: string;
  taskerPhone: string;
  taskType: string;
  description: string;
  location: string;
  status: string;
  platformFee: number;
  totalAmount: number;
  acceptedAt: string | null;
  paidAt: string | null;
  bookedAt: string | null;
};

function clampDays(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DAYS;
  }

  return Math.min(Math.max(parsed, 1), 365);
}

function toDateWindow(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const previousSince = new Date(since);
  previousSince.setDate(previousSince.getDate() - days);

  return { since, previousSince };
}

function toPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function mapCounts(items: CountDatum[], fallback = "Unknown") {
  return items.map((item) => ({
    label: item._id || fallback,
    count: item.count,
  }));
}

async function getMoneySummary(match: Record<string, unknown>) {
  const [summary] = await Order.aggregate<MoneySummary>([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$totalAmount" },
        amount: { $sum: "$amount" },
        serviceFee: { $sum: "$serviceFee" },
        platformFee: { $sum: "$platformFee" },
        taskerFee: { $sum: "$taskerFee" },
        waterFee: { $sum: "$waterFee" },
      },
    },
  ]);

  return {
    totalAmount: summary?.totalAmount || 0,
    amount: summary?.amount || 0,
    serviceFee: summary?.serviceFee || 0,
    platformFee: summary?.platformFee || 0,
    taskerFee: summary?.taskerFee || 0,
    waterFee: summary?.waterFee || 0,
  };
}

async function getUnsettledTaskers(): Promise<UnsettledTasker[]> {
  const rows = await Order.aggregate<{
    taskerId: string;
    taskerName?: string;
    taskerEmail?: string;
    taskerPhone?: string;
    isSettlementSuspended?: boolean;
    totalOutstanding: number;
    taskCount: number;
    overdueCount: number;
    oldestDueAt?: Date | null;
    latestCompletedAt?: Date | null;
    tasks: Array<{
      orderId: string;
      description?: string;
      taskType?: string;
      platformFee?: number;
      settlementStatus?: string;
      settlementDueAt?: Date | null;
      completedAt?: Date | null;
    }>;
  }>([
    {
      $match: {
        status: "completed",
        platformFee: { $gt: 0 },
        taskerId: { $exists: true, $nin: [null, ""] },
        $and: [
          {
            $or: [{ taskerHasPaid: false }, { taskerHasPaid: { $exists: false } }],
          },
          {
            $or: [
              { settlementStatus: { $in: [...OUTSTANDING_SETTLEMENT_STATUSES] } },
              { settlementStatus: { $exists: false } },
              { settlementStatus: null },
            ],
          },
        ],
      },
    },
    {
      $sort: {
        settlementDueAt: 1,
        completedAt: -1,
        createdAt: -1,
      },
    },
    {
      $group: {
        _id: "$taskerId",
        firstTaskerName: { $first: "$taskerName" },
        totalOutstanding: { $sum: "$platformFee" },
        taskCount: { $sum: 1 },
        overdueCount: {
          $sum: { $cond: [{ $eq: ["$settlementStatus", "overdue"] }, 1, 0] },
        },
        oldestDueAt: { $min: "$settlementDueAt" },
        latestCompletedAt: { $max: "$completedAt" },
        tasks: {
          $push: {
            orderId: { $toString: "$_id" },
            description: { $ifNull: ["$description", "$taskType"] },
            taskType: "$taskType",
            platformFee: "$platformFee",
            settlementStatus: "$settlementStatus",
            settlementDueAt: "$settlementDueAt",
            completedAt: "$completedAt",
          },
        },
      },
    },
    { $sort: { overdueCount: -1, totalOutstanding: -1, oldestDueAt: 1 } },
    { $limit: 25 },
    {
      $addFields: {
        taskerObjectId: {
          $convert: {
            input: "$_id",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: "taskers",
        localField: "taskerObjectId",
        foreignField: "_id",
        as: "tasker",
      },
    },
    { $unwind: { path: "$tasker", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "user",
        localField: "tasker.userId",
        foreignField: "_id",
        as: "taskerUser",
      },
    },
    { $unwind: { path: "$taskerUser", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        taskerId: "$_id",
        taskerName: {
          $ifNull: ["$taskerUser.name", { $ifNull: ["$firstTaskerName", "Unknown tasker"] }],
        },
        taskerEmail: { $ifNull: ["$taskerUser.email", ""] },
        taskerPhone: { $ifNull: ["$tasker.phone", ""] },
        isSettlementSuspended: { $ifNull: ["$tasker.isSettlementSuspended", false] },
        totalOutstanding: 1,
        taskCount: 1,
        overdueCount: 1,
        oldestDueAt: 1,
        latestCompletedAt: 1,
        tasks: { $slice: ["$tasks", 3] },
      },
    },
  ]);

  return rows.map((row) => ({
    taskerId: row.taskerId,
    taskerName: row.taskerName || "Unknown tasker",
    taskerEmail: row.taskerEmail || "",
    taskerPhone: row.taskerPhone || "",
    isSettlementSuspended: Boolean(row.isSettlementSuspended),
    totalOutstanding: row.totalOutstanding || 0,
    taskCount: row.taskCount || 0,
    overdueCount: row.overdueCount || 0,
    oldestDueAt: row.oldestDueAt ? row.oldestDueAt.toISOString() : null,
    latestCompletedAt: row.latestCompletedAt ? row.latestCompletedAt.toISOString() : null,
    tasks: row.tasks.map((task) => ({
      orderId: task.orderId,
      description: task.description || task.taskType || "Completed task",
      taskType: task.taskType || "others",
      platformFee: task.platformFee || 0,
      settlementStatus: task.settlementStatus || "pending",
      settlementDueAt: task.settlementDueAt ? task.settlementDueAt.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    })),
  }));
}

async function getActiveFinanceTasks(): Promise<ActiveFinanceTask[]> {
  const rows = await Order.aggregate<{
    orderId: string;
    taskerId?: string;
    taskerName?: string;
    taskerEmail?: string;
    taskerPhone?: string;
    taskType?: string;
    description?: string;
    location?: string;
    status?: string;
    platformFee?: number;
    totalAmount?: number;
    acceptedAt?: Date | null;
    paidAt?: Date | null;
    bookedAt?: Date | null;
  }>([
    {
      $match: {
        status: { $in: ["in_progress", "paid"] },
        platformFee: { $gt: 0 },
        taskerId: { $exists: true, $nin: [null, ""] },
      },
    },
    { $sort: { acceptedAt: -1, paidAt: -1, createdAt: -1 } },
    { $limit: 25 },
    {
      $addFields: {
        taskerObjectId: {
          $convert: {
            input: "$taskerId",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: "taskers",
        localField: "taskerObjectId",
        foreignField: "_id",
        as: "tasker",
      },
    },
    { $unwind: { path: "$tasker", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "user",
        localField: "tasker.userId",
        foreignField: "_id",
        as: "taskerUser",
      },
    },
    { $unwind: { path: "$taskerUser", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        orderId: { $toString: "$_id" },
        taskerId: "$taskerId",
        taskerName: {
          $ifNull: ["$taskerUser.name", { $ifNull: ["$taskerName", "Unknown tasker"] }],
        },
        taskerEmail: { $ifNull: ["$taskerUser.email", ""] },
        taskerPhone: { $ifNull: ["$tasker.phone", ""] },
        taskType: "$taskType",
        description: { $ifNull: ["$description", "$taskType"] },
        location: "$location",
        status: "$status",
        platformFee: "$platformFee",
        totalAmount: "$totalAmount",
        acceptedAt: "$acceptedAt",
        paidAt: "$paidAt",
        bookedAt: { $ifNull: ["$bookedAt", "$createdAt"] },
      },
    },
  ]);

  return rows.map((row) => ({
    orderId: row.orderId,
    taskerId: row.taskerId || "",
    taskerName: row.taskerName || "Unknown tasker",
    taskerEmail: row.taskerEmail || "",
    taskerPhone: row.taskerPhone || "",
    taskType: row.taskType || "others",
    description: row.description || row.taskType || "Active task",
    location: row.location || "Unknown location",
    status: row.status || "in_progress",
    platformFee: row.platformFee || 0,
    totalAmount: row.totalAmount || 0,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    bookedAt: row.bookedAt ? row.bookedAt.toISOString() : null,
  }));
}

async function getAnalyticsSummary(match: Record<string, unknown>, limit = 8) {
  const [
    totalPageViews,
    uniqueVisitors,
    topPages,
    topReferralSources,
    deviceBreakdown,
    browserBreakdown,
    conversionEvents,
    trafficChart,
  ] = await Promise.all([
    AnalyticsEventModel.countDocuments({ ...match, eventType: "page_view" }),
    AnalyticsEventModel.distinct("visitorId", match),
    AnalyticsEventModel.aggregate<CountDatum>([
      { $match: { ...match, eventType: "page_view" } },
      { $group: { _id: "$page", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$device", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEventModel.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$browser", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountDatum>([
      { $match: { ...match, eventType: { $ne: "page_view" } } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
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
  ]);

  return {
    totalPageViews,
    uniqueVisitors: uniqueVisitors.length,
    topPages: mapCounts(topPages, "/"),
    topReferralSources: mapCounts(topReferralSources, "Direct"),
    deviceBreakdown: mapCounts(deviceBreakdown),
    browserBreakdown: mapCounts(browserBreakdown),
    conversionEvents: mapCounts(conversionEvents),
    trafficChart: trafficChart.map((item) => ({
      date: item._id,
      pageViews: item.pageViews,
      uniqueVisitors: item.uniqueVisitors.length,
    })),
  };
}

function buildCards(role: ExcoRole, data: {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  activeOrders: number;
  declinedTasks: number;
  paymentFailures: number;
  totalUsers: number;
  newUsers: number;
  activeTaskers: number;
  suspendedTaskers: number;
  reviews: number;
  averageResponseMinutes: number;
  completionRate: number;
  conversionRate: number;
  conversionsTotal: number;
  currentMoney: Awaited<ReturnType<typeof getMoneySummary>>;
  completedMoney: Awaited<ReturnType<typeof getMoneySummary>>;
  outstandingPlatformFees: number;
  analytics: Awaited<ReturnType<typeof getAnalyticsSummary>>;
}): DashboardCard[] {
  if (role === "CFO") {
    return [
      {
        label: "Gross order value",
        value: data.currentMoney.totalAmount,
        format: "currency",
        description: "Total customer value created in this period.",
      },
      {
        label: "Completed revenue",
        value: data.completedMoney.totalAmount,
        format: "currency",
        description: "Value from completed errands only.",
      },
      {
        label: "Platform fees",
        value: data.completedMoney.platformFee,
        format: "currency",
        description: "SwiftDU earnings from completed work.",
      },
      {
        label: "Unpaid platform fees",
        value: data.outstandingPlatformFees,
        format: "currency",
        description: "Tasker settlement still pending.",
      },
    ];
  }

  if (role === "CMO") {
    return [
      {
        label: "Unique visitors",
        value: data.analytics.uniqueVisitors,
        format: "number",
        description: "Distinct visitors recorded by analytics.",
      },
      {
        label: "Page views",
        value: data.analytics.totalPageViews,
        format: "number",
        description: "Total production page views.",
      },
      {
        label: "New users",
        value: data.newUsers,
        format: "number",
        description: "Registered accounts created this period.",
      },
      {
        label: "Visit to order rate",
        value: data.conversionRate,
        format: "percent",
        description: "Orders created divided by unique visitors.",
      },
    ];
  }

  if (role === "COO") {
    return [
      {
        label: "Open orders",
        value: data.activeOrders,
        format: "number",
        description: "Pending, in progress, or paid errands.",
      },
      {
        label: "Completed orders",
        value: data.completedOrders,
        format: "number",
        description: "Operational throughput this period.",
      },
      {
        label: "Avg response time",
        value: data.averageResponseMinutes,
        format: "minutes",
        description: "Average booking to tasker acceptance time.",
      },
      {
        label: "Completion rate",
        value: data.completionRate,
        format: "percent",
        description: "Completed orders divided by total orders.",
      },
    ];
  }

  return [
    {
      label: "Page views",
      value: data.analytics.totalPageViews,
      format: "number",
      description: "Frontend traffic load signal.",
    },
    {
      label: "Payment failures",
      value: data.paymentFailures,
      format: "number",
      description: "Failed payment attempts to inspect.",
    },
    {
      label: "Transfer issues",
      value: data.declinedTasks,
      format: "number",
      description: "Orders flagged for payment review.",
    },
    {
      label: "Suspended taskers",
      value: data.suspendedTaskers,
      format: "number",
      description: "Tasker accounts blocked by settlement rules.",
    },
  ];
}

function buildInsights(role: ExcoRole, data: {
  pendingOrders: number;
  declinedTasks: number;
  paymentFailures: number;
  activeTaskers: number;
  outstandingPlatformFees: number;
  topCategory?: string;
  topLocation?: string;
  topPage?: string;
  topReferral?: string;
}) {
  if (role === "CFO") {
    return [
      {
        label: "Settlement follow-up",
        value: data.outstandingPlatformFees,
        format: "currency",
        description: "Prioritize taskers with unpaid platform fees before expanding payouts.",
        severity: data.outstandingPlatformFees > 0 ? "warning" : "good",
      },
      {
        label: "Transfer disputes",
        value: data.declinedTasks,
        format: "number",
        description: "Review declined transfers before they become revenue leakage.",
        severity: data.declinedTasks > 0 ? "critical" : "good",
      },
    ];
  }

  if (role === "CMO") {
    return [
      {
        label: "Best acquisition source",
        value: data.topReferral || "Direct",
        format: "text",
        description: "Use this channel as the first place to test campaign spend.",
        severity: "info",
      },
      {
        label: "Highest intent page",
        value: data.topPage || "/",
        format: "text",
        description: "Promote or improve this page because visitors already gravitate to it.",
        severity: "info",
      },
    ];
  }

  if (role === "COO") {
    return [
      {
        label: "Pending workload",
        value: data.pendingOrders,
        format: "number",
        description: "Open requests that still need tasker attention.",
        severity: data.pendingOrders > data.activeTaskers ? "warning" : "info",
      },
      {
        label: "Demand hotspot",
        value: data.topLocation || "No location data",
        format: "text",
        description: "Consider tasker coverage and response planning around this area.",
        severity: "info",
      },
    ];
  }

  return [
    {
      label: "Checkout reliability",
      value: data.paymentFailures,
      format: "number",
      description: "Investigate failed payment events and provider errors.",
      severity: data.paymentFailures > 0 ? "warning" : "good",
    },
    {
      label: "Most loaded page",
      value: data.topPage || "/",
      format: "text",
      description: "Watch this route first when checking frontend performance.",
      severity: "info",
    },
  ];
}

export async function GET(request: NextRequest) {
  const requestedRole = normalizeExcoRole(request.nextUrl.searchParams.get("role"));

  if (!requestedRole) {
    return NextResponse.json({ error: "Invalid executive role" }, { status: 400 });
  }

  const access = await getExcoAccess(request.headers);

  if (!access.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (access.excoRole !== requestedRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = clampDays(request.nextUrl.searchParams.get("days"));
  const { since, previousSince } = toDateWindow(days);
  const match = {
    createdAt: { $gte: since },
    status: { $ne: "cancelled" },
  };
  const previousMatch = {
    createdAt: { $gte: previousSince, $lt: since },
    status: { $ne: "cancelled" },
  };

  await connectDB();

  const [
    totalOrders,
    previousOrders,
    completedOrders,
    pendingOrders,
    activeOrders,
    declinedTasks,
    paymentFailures,
    totalUsers,
    newUsers,
    activeTaskers,
    suspendedTaskers,
    reviews,
    currentMoney,
    completedMoney,
    previousMoney,
    outstandingPlatformFeesSummary,
    statusBreakdown,
    categoryBreakdown,
    locationDemand,
    settlementBreakdown,
    paymentBreakdown,
    averageResponseSummary,
    orderTrend,
    analytics,
    unsettledTaskers,
    activeFinanceTasks,
  ] = await Promise.all([
    Order.countDocuments(match),
    Order.countDocuments(previousMatch),
    Order.countDocuments({ ...match, status: "completed" }),
    Order.countDocuments({ ...match, status: "pending" }),
    Order.countDocuments({ ...match, status: { $in: ["pending", "in_progress", "paid"] } }),
    Order.countDocuments({ ...match, isDeclinedTask: true }),
    Order.countDocuments({ ...match, paymentStatus: "failed" }),
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: since } }),
    Tasker.countDocuments({ isVerified: true }),
    Tasker.countDocuments({ isSettlementSuspended: true }),
    Review.countDocuments({ createdAt: { $gte: since } }),
    getMoneySummary(match),
    getMoneySummary({ ...match, status: "completed" }),
    getMoneySummary(previousMatch),
    getMoneySummary({
      status: "completed",
      $or: [{ taskerHasPaid: false }, { settlementStatus: { $ne: "paid" } }],
    }),
    Order.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$taskType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Order.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Order.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$settlementStatus", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate<CountDatum>([
      { $match: match },
      { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate<{ _id: null; averageMinutes: number }>([
      {
        $match: {
          ...match,
          acceptedAt: { $exists: true },
        },
      },
      {
        $project: {
          responseMinutes: {
            $divide: [
              { $subtract: ["$acceptedAt", { $ifNull: ["$bookedAt", "$createdAt"] }] },
              60000,
            ],
          },
        },
      },
      { $group: { _id: null, averageMinutes: { $avg: "$responseMinutes" } } },
    ]),
    Order.aggregate<{ _id: string; orders: number; completed: number; revenue: number }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$totalAmount", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    getAnalyticsSummary(match),
    requestedRole === "CFO" ? getUnsettledTaskers() : Promise.resolve([]),
    requestedRole === "CFO" ? getActiveFinanceTasks() : Promise.resolve([]),
  ]);

  const conversionsTotal = analytics.conversionEvents.reduce(
    (total, item) => total + item.count,
    0
  );
  const completionRate = toPercent(completedOrders, totalOrders);
  const conversionRate = toPercent(totalOrders, analytics.uniqueVisitors);
  const averageResponseMinutes = Math.round(
    (averageResponseSummary[0]?.averageMinutes || 0) * 10
  ) / 10;

  const dashboardData = {
    totalOrders,
    completedOrders,
    pendingOrders,
    activeOrders,
    declinedTasks,
    paymentFailures,
    totalUsers,
    newUsers,
    activeTaskers,
    suspendedTaskers,
    reviews,
    averageResponseMinutes,
    completionRate,
    conversionRate,
    conversionsTotal,
    currentMoney,
    completedMoney,
    outstandingPlatformFees: outstandingPlatformFeesSummary.platformFee,
    analytics,
  };

  return NextResponse.json({
    role: requestedRole,
    range: {
      days,
      since: since.toISOString(),
    },
    cards: buildCards(requestedRole, dashboardData),
    insights: buildInsights(requestedRole, {
      pendingOrders,
      declinedTasks,
      paymentFailures,
      activeTaskers,
      outstandingPlatformFees: outstandingPlatformFeesSummary.platformFee,
      topCategory: categoryBreakdown[0]?._id,
      topLocation: locationDemand[0]?._id,
      topPage: analytics.topPages[0]?.label,
      topReferral: analytics.topReferralSources[0]?.label,
    }),
    finance: {
      currentMoney,
      completedMoney,
      previousMoney,
      outstandingPlatformFees: outstandingPlatformFeesSummary.platformFee,
      unsettledTaskers,
      activeFinanceTasks,
    },
    operations: {
      totalOrders,
      previousOrders,
      completedOrders,
      pendingOrders,
      activeOrders,
      declinedTasks,
      activeTaskers,
      completionRate,
      averageResponseMinutes,
      reviews,
    },
    technology: {
      paymentFailures,
      suspendedTaskers,
      deviceBreakdown: analytics.deviceBreakdown,
      browserBreakdown: analytics.browserBreakdown,
    },
    marketing: {
      totalUsers,
      newUsers,
      conversionRate,
      conversionsTotal,
      analytics,
    },
    charts: {
      orderTrend: orderTrend.map((item) => ({
        date: item._id,
        orders: item.orders,
        completed: item.completed,
        revenue: item.revenue,
      })),
      statusBreakdown: mapCounts(statusBreakdown),
      categoryBreakdown: mapCounts(categoryBreakdown),
      locationDemand: mapCounts(locationDemand),
      settlementBreakdown: mapCounts(settlementBreakdown),
      paymentBreakdown: mapCounts(paymentBreakdown),
    },
  });
}
