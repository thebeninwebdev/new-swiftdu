import { NextResponse, type NextRequest } from "next/server";

import { getExcoAccess, normalizeExcoRole, type ExcoRole } from "@/lib/exco";
import { connectDB } from "@/lib/db";
import { AnalyticsEventModel } from "@/models/analytics";
import {
  calculateNetPlatformProfit,
  calculatePaystackSettlementFee,
  excludeCancelledOrders,
} from "@/lib/order-finance";
import { Order } from "@/models/order";
import { Review } from "@/models/review";
import Tasker from "@/models/tasker";
import { User } from "@/models/user";

const DEFAULT_DAYS = 30;
const ANALYTICS_RANGES = {
  "24h": {
    label: "Last 24 hours",
    days: 1,
    amount: 24,
    unit: "hours",
    dateFormat: "%Y-%m-%d %H:00",
  },
  "7d": {
    label: "Last 7 days",
    days: 7,
    amount: 7,
    unit: "days",
    dateFormat: "%Y-%m-%d",
  },
  "30d": {
    label: "Last 30 days",
    days: 30,
    amount: 30,
    unit: "days",
    dateFormat: "%Y-%m-%d",
  },
  "3mo": {
    label: "Last 3 months",
    days: 90,
    amount: 3,
    unit: "months",
    dateFormat: "%Y-%m-%d",
  },
  "12mo": {
    label: "Last 12 months",
    days: 365,
    amount: 12,
    unit: "months",
    dateFormat: "%Y-%m",
  },
  "24mo": {
    label: "Last 24 months",
    days: 730,
    amount: 24,
    unit: "months",
    dateFormat: "%Y-%m",
  },
} as const;
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
  paystackSettlementFee: number;
  netPlatformProfit: number;
  taskerFee: number;
  waterFee: number;
};

type DashboardCard = {
  label: string;
  value: number;
  format: "number" | "currency" | "percent" | "minutes";
  description: string;
};

type AnalyticsRangeKey = keyof typeof ANALYTICS_RANGES;

type RecentActivity = {
  id: string;
  type: "order" | "tasker" | "review" | "cancelled" | "declined";
  message: string;
  timestamp: string;
  status?: string;
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

type CancelledFinanceOrder = {
  orderId: string;
  taskType: string;
  description: string;
  location: string;
  userId: string;
  userName: string;
  userEmail: string;
  taskerId: string;
  taskerName: string;
  amount: number;
  platformFee: number;
  totalAmount: number;
  cancelledAt: string | null;
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

function getAnalyticsRange(value: string | null) {
  const key = value && value in ANALYTICS_RANGES ? (value as AnalyticsRangeKey) : "7d";
  const config = ANALYTICS_RANGES[key];
  const since = new Date();

  if (config.unit === "hours") {
    since.setHours(since.getHours() - config.amount, 0, 0, 0);
  } else if (config.unit === "months") {
    since.setMonth(since.getMonth() - config.amount);
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - config.amount + 1);
    since.setHours(0, 0, 0, 0);
  }

  const previousSince = new Date(since);
  if (config.unit === "hours") {
    previousSince.setHours(previousSince.getHours() - config.amount);
  } else if (config.unit === "months") {
    previousSince.setMonth(previousSince.getMonth() - config.amount);
  } else {
    previousSince.setDate(previousSince.getDate() - config.amount);
  }

  return { key, ...config, since, previousSince };
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

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatAnalyticsBucket(date: Date, dateFormat: string) {
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());
  const hour = padDatePart(date.getUTCHours());

  if (dateFormat === "%Y-%m-%d %H:00") return `${year}-${month}-${day} ${hour}:00`;
  if (dateFormat === "%Y-%m") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function buildAnalyticsBuckets(rangeKey: AnalyticsRangeKey, since: Date, dateFormat: string) {
  const buckets: string[] = [];
  const cursor = new Date(since);
  const now = new Date();

  if (rangeKey === "24h") {
    cursor.setUTCMinutes(0, 0, 0);
    while (cursor <= now) {
      buckets.push(formatAnalyticsBucket(cursor, dateFormat));
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
    return buckets;
  }

  if (rangeKey === "12mo" || rangeKey === "24mo") {
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= now) {
      buckets.push(formatAnalyticsBucket(cursor, dateFormat));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return buckets;
  }

  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= now) {
    buckets.push(formatAnalyticsBucket(cursor, dateFormat));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

async function getMoneySummary(match: Record<string, unknown>) {
  const financeMatch = excludeCancelledOrders(match);
  const [summary] = await Order.aggregate<MoneySummary>([
    { $match: financeMatch },
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
    paystackSettlementFee: calculatePaystackSettlementFee(summary?.platformFee || 0),
    netPlatformProfit: calculateNetPlatformProfit(summary?.platformFee || 0),
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

async function getCancelledFinanceOrders(since: Date): Promise<CancelledFinanceOrder[]> {
  const rows = await Order.aggregate<{
    orderId: string;
    taskType?: string;
    description?: string;
    location?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    taskerId?: string;
    taskerName?: string;
    amount?: number;
    platformFee?: number;
    totalAmount?: number;
    cancelledAt?: Date | null;
    bookedAt?: Date | null;
  }>([
    {
      $match: {
        status: "cancelled",
        createdAt: { $gte: since },
      },
    },
    { $sort: { cancelledAt: -1, updatedAt: -1, createdAt: -1 } },
    { $limit: 25 },
    {
      $addFields: {
        userObjectId: {
          $convert: {
            input: "$userId",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: "user",
        localField: "userObjectId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        orderId: { $toString: "$_id" },
        taskType: "$taskType",
        description: { $ifNull: ["$description", "$taskType"] },
        location: "$location",
        userId: "$userId",
        userName: { $ifNull: ["$customer.name", "Unknown customer"] },
        userEmail: { $ifNull: ["$customer.email", ""] },
        taskerId: { $ifNull: ["$taskerId", ""] },
        taskerName: { $ifNull: ["$taskerName", "Unassigned"] },
        amount: "$amount",
        platformFee: "$platformFee",
        totalAmount: "$totalAmount",
        cancelledAt: "$cancelledAt",
        bookedAt: { $ifNull: ["$bookedAt", "$createdAt"] },
      },
    },
  ]);

  return rows.map((row) => ({
    orderId: row.orderId,
    taskType: row.taskType || "others",
    description: row.description || row.taskType || "Cancelled order",
    location: row.location || "Unknown location",
    userId: row.userId || "",
    userName: row.userName || "Unknown customer",
    userEmail: row.userEmail || "",
    taskerId: row.taskerId || "",
    taskerName: row.taskerName || "Unassigned",
    amount: row.amount || 0,
    platformFee: row.platformFee || 0,
    totalAmount: row.totalAmount || 0,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    bookedAt: row.bookedAt ? row.bookedAt.toISOString() : null,
  }));
}

async function getRecentActivity(limit = 10): Promise<RecentActivity[]> {
  const [recentOrders, recentTaskers, recentReviews] = await Promise.all([
    Order.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select("taskType location status isDeclinedTask declinedAt updatedAt createdAt")
      .lean(),
    Tasker.find({ isVerified: false, isRejected: false })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("userId", "name")
      .lean(),
    Review.find()
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("userId", "name")
      .lean(),
  ]);

  return [
    ...recentOrders.map((order) => ({
      id: order._id.toString(),
      type:
        order.status === "cancelled"
          ? ("cancelled" as const)
          : order.isDeclinedTask
            ? ("declined" as const)
            : ("order" as const),
      message:
        order.status === "cancelled"
          ? `Cancelled order: ${order.taskType} task in ${order.location}`
          : order.isDeclinedTask
            ? `Transfer issue flagged for ${order.taskType} in ${order.location}`
            : `Order update: ${order.taskType} task in ${order.location}`,
      timestamp: (
        order.isDeclinedTask
          ? order.declinedAt || order.updatedAt || order.createdAt
          : order.updatedAt || order.createdAt
      ).toISOString(),
      status: order.status,
    })),
    ...recentTaskers.map((tasker) => ({
      id: tasker._id.toString(),
      type: "tasker" as const,
      message: `${(tasker as { userId?: { name?: string } }).userId?.name || "New user"} applied to be a tasker`,
      timestamp: tasker.createdAt.toISOString(),
      status: "pending",
    })),
    ...recentReviews.map((review) => ({
      id: review._id.toString(),
      type: "review" as const,
      message: `${(review as { userId?: { name?: string } }).userId?.name || "User"} left a review`,
      timestamp: review.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

async function getAnalyticsSummary(
  match: Record<string, unknown>,
  limit = 8,
  dateFormat = "%Y-%m-%d",
  rangeKey?: AnalyticsRangeKey,
  since?: Date
) {
  const [
    totalPageViews,
    uniqueVisitors,
    topPages,
    topReferralSources,
    topCountries,
    deviceBreakdown,
    browserBreakdown,
    conversionEvents,
    trafficChart,
    bounceSummary,
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
      { $match: { ...match, eventType: "page_view" } },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    AnalyticsEventModel.aggregate<CountDatum>([
      { $match: { ...match, eventType: "page_view" } },
      { $group: { _id: "$country", count: { $sum: 1 } } },
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
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          pageViews: {
            $sum: { $cond: [{ $eq: ["$eventType", "page_view"] }, 1, 0] },
          },
          uniqueVisitors: { $addToSet: "$visitorId" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AnalyticsEventModel.aggregate<{ _id: null; totalVisitors: number; bouncedVisitors: number }>([
      { $match: { ...match, eventType: "page_view" } },
      {
        $group: {
          _id: "$visitorId",
          pageViews: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalVisitors: { $sum: 1 },
          bouncedVisitors: {
            $sum: { $cond: [{ $eq: ["$pageViews", 1] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const bounceVisitors = bounceSummary[0]?.bouncedVisitors || 0;
  const totalVisitors = bounceSummary[0]?.totalVisitors || 0;

  const trafficMap = new Map(
    trafficChart.map((item) => [
      item._id,
      {
        date: item._id,
        pageViews: item.pageViews,
        uniqueVisitors: item.uniqueVisitors.length,
      },
    ])
  );
  const filledTrafficChart =
    rangeKey && since
      ? buildAnalyticsBuckets(rangeKey, since, dateFormat).map((bucket) => ({
          date: bucket,
          pageViews: trafficMap.get(bucket)?.pageViews || 0,
          uniqueVisitors: trafficMap.get(bucket)?.uniqueVisitors || 0,
        }))
      : trafficChart.map((item) => ({
          date: item._id,
          pageViews: item.pageViews,
          uniqueVisitors: item.uniqueVisitors.length,
        }));

  return {
    totalPageViews,
    uniqueVisitors: uniqueVisitors.length,
    bounceRate: toPercent(bounceVisitors, totalVisitors),
    topPages: mapCounts(topPages, "/"),
    topReferralSources: mapCounts(topReferralSources, "Direct"),
    topCountries: mapCounts(topCountries),
    deviceBreakdown: mapCounts(deviceBreakdown),
    browserBreakdown: mapCounts(browserBreakdown),
    conversionEvents: mapCounts(conversionEvents),
    trafficChart: filledTrafficChart,
  };
}

function buildCards(role: ExcoRole, data: {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  activeOrders: number;
  cancelledOrders: number;
  declinedTasks: number;
  paymentFailures: number;
  totalUsers: number;
  newUsers: number;
  totalTaskers: number;
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
        label: "Profit made",
        value: data.completedMoney.netPlatformProfit,
        format: "currency",
        description: "SwiftDU platform fees after Paystack settlement charges.",
      },
      {
        label: "Paystack fees",
        value: data.completedMoney.paystackSettlementFee,
        format: "currency",
        description: "1.5% charge on platform-fee settlements.",
      },
      {
        label: "Paid to taskers",
        value: data.completedMoney.taskerFee,
        format: "currency",
        description: "Tasker compensation from completed orders.",
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
        label: "Cancelled orders",
        value: data.cancelledOrders,
        format: "number",
        description: "Cancelled orders included in COO completion rate.",
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
      label: "Total users",
      value: data.totalUsers,
      format: "number",
      description: "All registered user accounts.",
    },
    {
      label: "Tasker count",
      value: data.totalTaskers,
      format: "number",
      description: "All tasker profiles in the system.",
    },
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

  const requestedAnalyticsRange = getAnalyticsRange(request.nextUrl.searchParams.get("range"));
  const hasAnalyticsRange = request.nextUrl.searchParams.has("range");
  const days = hasAnalyticsRange ? requestedAnalyticsRange.days : clampDays(request.nextUrl.searchParams.get("days"));
  const dateWindow = hasAnalyticsRange ? requestedAnalyticsRange : toDateWindow(days);
  const { since, previousSince } = dateWindow;
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
    cancelledOrders,
    declinedTasks,
    paymentFailures,
    totalUsers,
    newUsers,
    totalTaskers,
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
    cancelledFinanceOrders,
    recentActivity,
  ] = await Promise.all([
    Order.countDocuments(match),
    Order.countDocuments(previousMatch),
    Order.countDocuments({ ...match, status: "completed" }),
    Order.countDocuments({ ...match, status: "pending" }),
    Order.countDocuments({ ...match, status: { $in: ["pending", "in_progress", "paid"] } }),
    Order.countDocuments({ createdAt: { $gte: since }, status: "cancelled" }),
    Order.countDocuments({ ...match, isDeclinedTask: true }),
    Order.countDocuments({ ...match, paymentStatus: "failed" }),
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: since } }),
    Tasker.countDocuments(),
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
    getAnalyticsSummary(
      match,
      8,
      hasAnalyticsRange ? requestedAnalyticsRange.dateFormat : "%Y-%m-%d",
      hasAnalyticsRange ? requestedAnalyticsRange.key : undefined,
      hasAnalyticsRange ? since : undefined
    ),
    requestedRole === "CFO" ? getUnsettledTaskers() : Promise.resolve([]),
    requestedRole === "CFO" ? getActiveFinanceTasks() : Promise.resolve([]),
    requestedRole === "CFO" ? getCancelledFinanceOrders(since) : Promise.resolve([]),
    requestedRole === "COO" ? getRecentActivity() : Promise.resolve([]),
  ]);

  const conversionsTotal = analytics.conversionEvents.reduce(
    (total, item) => total + item.count,
    0
  );
  const completionRate = toPercent(
    completedOrders,
    requestedRole === "COO" ? totalOrders + cancelledOrders : totalOrders
  );
  const conversionRate = toPercent(totalOrders, analytics.uniqueVisitors);
  const averageResponseMinutes = Math.round(
    (averageResponseSummary[0]?.averageMinutes || 0) * 10
  ) / 10;

  const dashboardData = {
    totalOrders,
    completedOrders,
    pendingOrders,
    activeOrders,
    cancelledOrders,
    declinedTasks,
    paymentFailures,
    totalUsers,
    newUsers,
    totalTaskers,
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
      key: hasAnalyticsRange ? requestedAnalyticsRange.key : `${days}d`,
      label: hasAnalyticsRange ? requestedAnalyticsRange.label : `Last ${days} days`,
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
      cancelledFinanceOrders,
    },
    operations: {
      totalOrders,
      previousOrders,
      completedOrders,
      pendingOrders,
      activeOrders,
      cancelledOrders,
      declinedTasks,
      activeTaskers,
      completionRate,
      averageResponseMinutes,
      reviews,
      recentActivity,
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
