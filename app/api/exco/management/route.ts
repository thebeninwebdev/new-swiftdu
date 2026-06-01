import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";

import { getExcoAccess, type ExcoRole } from "@/lib/exco";
import { connectDB } from "@/lib/db";
import { emitOrderUpdated } from "@/lib/socket";
import { syncTaskerSettlementStatus } from "@/lib/tasker-settlement";
import DryCleaner from "@/models/dry-cleaner";
import { Order } from "@/models/order";
import { Review } from "@/models/review";
import Support from "@/models/support";
import Tasker from "@/models/tasker";
import { User } from "@/models/user";

type Resource =
  | "taskers"
  | "dry-cleaners"
  | "reviews"
  | "users"
  | "support"
  | "orders"
  | "failed-settlements";

const RESOURCE_ACCESS: Record<Resource, ExcoRole[]> = {
  taskers: ["COO", "CFO", "CTO"],
  "dry-cleaners": ["COO"],
  reviews: ["COO"],
  users: ["CFO", "COO", "CMO", "CTO"],
  support: ["CTO"],
  orders: ["COO", "CTO"],
  "failed-settlements": ["CTO"],
};

function canAccess(resource: Resource, role: ExcoRole | null) {
  return Boolean(role && RESOURCE_ACCESS[resource].includes(role));
}

function normalizeResource(value: string | null): Resource | null {
  if (
    value === "taskers" ||
    value === "dry-cleaners" ||
    value === "reviews" ||
    value === "users" ||
    value === "support" ||
    value === "orders" ||
    value === "failed-settlements"
  ) {
    return value;
  }

  return null;
}

function badResource() {
  return NextResponse.json({ error: "Invalid management resource" }, { status: 400 });
}

function getUserLookupConditions({
  id,
  email,
}: {
  id?: string | null;
  email?: string | null;
}) {
  const conditions: Record<string, unknown>[] = [];

  if (id) {
    conditions.push({ id });

    if (Types.ObjectId.isValid(id)) {
      conditions.push({ _id: new Types.ObjectId(id) });
    }
  }

  if (email) {
    conditions.push({ email: email.trim().toLowerCase() });
  }

  return conditions;
}

async function getDryCleaners() {
  const dryCleaners = await DryCleaner.find()
    .sort({ status: 1, createdAt: -1 })
    .limit(40)
    .lean();

  const userIds = dryCleaners.map((dryCleaner) => dryCleaner.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name email")
    .lean();

  const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user]));

  return dryCleaners.map((dryCleaner) => ({
    id: dryCleaner._id.toString(),
    businessName: dryCleaner.businessName,
    ownerName: dryCleaner.ownerName,
    email: userMap[dryCleaner.userId.toString()]?.email || "",
    phone: dryCleaner.phone,
    location: dryCleaner.location,
    businessLogo: dryCleaner.businessLogo || "",
    status: dryCleaner.status,
    pricing: {
      shirt: dryCleaner.pricing?.shirt || 0,
      trouser: dryCleaner.pricing?.trouser || 0,
      hoodieMin: dryCleaner.pricing?.hoodieMin || 0,
      hoodieMax: dryCleaner.pricing?.hoodieMax || 0,
      bedsheetMin: dryCleaner.pricing?.bedsheetMin || 0,
      bedsheetMax: dryCleaner.pricing?.bedsheetMax || 0,
      duvetMin: dryCleaner.pricing?.duvetMin || 2000,
      duvetMax: dryCleaner.pricing?.duvetMax || 2500,
      underwear: dryCleaner.pricing?.underwear || 500,
      shoes: dryCleaner.pricing?.shoes || 500,
      doesNotWashShirt: dryCleaner.pricing?.doesNotWashShirt === true,
      doesNotWashTrouser: dryCleaner.pricing?.doesNotWashTrouser === true,
      doesNotWashHoodie: dryCleaner.pricing?.doesNotWashHoodie === true,
      doesNotWashBedsheet: dryCleaner.pricing?.doesNotWashBedsheet === true,
      doesNotWashDuvet: dryCleaner.pricing?.doesNotWashDuvet !== false,
      doesNotWashUnderwear: dryCleaner.pricing?.doesNotWashUnderwear !== false,
      doesNotWashShoes: dryCleaner.pricing?.doesNotWashShoes !== false,
    },
    availability: {
      acceptingDays: dryCleaner.availability?.acceptingDays || [],
      expectedDeliveryDays: dryCleaner.availability?.expectedDeliveryDays || 1,
      cutoffTime: dryCleaner.availability?.cutoffTime || "17:00",
      temporarilyClosed: Boolean(dryCleaner.availability?.temporarilyClosed),
    },
    notes: dryCleaner.notes || "",
    createdAt: dryCleaner.createdAt,
  }));
}

async function getTaskers() {
  const taskers = await Tasker.find()
    .sort({ isVerified: 1, isRejected: 1, createdAt: -1 })
    .limit(40)
    .lean();

  const userIds = taskers.map((tasker) => tasker.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name email")
    .lean();

  const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user]));

  return taskers.map((tasker) => ({
    id: tasker._id.toString(),
    name: userMap[tasker.userId.toString()]?.name || "Unknown tasker",
    email: userMap[tasker.userId.toString()]?.email || "",
    phone: tasker.phone,
    location: tasker.location,
    studentId: tasker.studentId,
    isVerified: tasker.isVerified,
    isRejected: Boolean(tasker.isRejected),
    isSettlementSuspended: Boolean(tasker.isSettlementSuspended),
    bankDetails: {
      bankName: tasker.bankDetails?.bankName || "",
      accountNumber: tasker.bankDetails?.accountNumber || "",
      accountName: tasker.bankDetails?.accountName || "",
    },
    completedTasks: tasker.completedTasks,
    rating: tasker.rating,
    createdAt: tasker.createdAt,
  }));
}

async function getReviews() {
  const reviews = await Review.find()
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  const userIds = [...new Set(reviews.map((review) => review.userId.toString()))];
  const taskerIds = [...new Set(reviews.map((review) => review.taskerId.toString()))];

  const [users, taskers] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("_id name email").lean(),
    Tasker.find({ _id: { $in: taskerIds } }).select("_id userId").populate("userId", "name").lean(),
  ]);

  const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user]));
  const taskerMap = Object.fromEntries(
    taskers.map((tasker) => [
      tasker._id.toString(),
      (tasker as unknown as { userId?: { name?: string } }).userId?.name || "Unknown tasker",
    ])
  );

  return reviews.map((review) => ({
    id: review._id.toString(),
    rating: review.rating,
    comment: review.comment,
    userName: userMap[review.userId.toString()]?.name || "Unknown user",
    userEmail: userMap[review.userId.toString()]?.email || "",
    taskerName: taskerMap[review.taskerId.toString()] || "Unknown tasker",
    createdAt: review.createdAt,
  }));
}

async function getUsers(excoRole: ExcoRole) {
  const filters =
    excoRole === "COO" || excoRole === "CTO"
      ? { role: { $ne: "admin" } }
      : {};

  const users = await User.find(filters)
    .sort({ createdAt: -1 })
    .select("_id name email phone role emailVerified isSuspended dateOfBirth createdAt serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders")
    .lean();

  const userIds = users.map((user) => user._id.toString());
  const orderCounts = await Order.aggregate<{ _id: string; count: number }>([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  const orderCountMap = Object.fromEntries(orderCounts.map((item) => [item._id, item.count]));

  return Promise.all(users.map(async (user) => {
    const activeDiscount = Boolean(
      user.serviceFeeDiscountEnabled &&
        Number(user.serviceFeeDiscountRemainingOrders || 0) > 0
    );
    let serviceFeeDiscountGrantedByName = user.serviceFeeDiscountGrantedByName || "";
    let serviceFeeDiscountGrantedByPhone = user.serviceFeeDiscountGrantedByPhone || "";

    if (
      activeDiscount &&
      user.serviceFeeDiscountGrantedByUserId &&
      !serviceFeeDiscountGrantedByPhone
    ) {
      const grantorLookupConditions = getUserLookupConditions({
        id: user.serviceFeeDiscountGrantedByUserId,
      });
      const grantor = grantorLookupConditions.length
        ? await User.findOne({ $or: grantorLookupConditions })
            .select("name phone email")
            .lean()
        : null;

      serviceFeeDiscountGrantedByName =
        serviceFeeDiscountGrantedByName || grantor?.name || grantor?.email || "";
      serviceFeeDiscountGrantedByPhone =
        typeof grantor?.phone === "string" ? grantor.phone.trim() : "";
    }

    return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    emailVerified: user.emailVerified,
    isSuspended: Boolean(user.isSuspended),
    serviceFeeDiscountEnabled: activeDiscount,
    serviceFeeDiscountGrantedByName,
    serviceFeeDiscountGrantedByPhone,
    serviceFeeDiscountRemainingOrders: Number(user.serviceFeeDiscountRemainingOrders || 0),
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    orderCount: orderCountMap[user._id.toString()] || 0,
    createdAt: user.createdAt,
    };
  }));
}

async function getOrders() {
  const rows = await Order.aggregate<{
    id: string;
    taskType?: string;
    description?: string;
    location?: string;
    status?: string;
    totalAmount?: number;
    taskerId?: string;
    taskerName?: string;
    taskerEmail?: string;
    taskerPhone?: string;
    userName?: string;
    userEmail?: string;
    acceptedAt?: Date | null;
    createdAt?: Date | null;
  }>([
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
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
        from: "user",
        localField: "userObjectId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
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
        id: { $toString: "$_id" },
        taskType: "$taskType",
        description: { $ifNull: ["$description", "$taskType"] },
        location: "$location",
        status: "$status",
        totalAmount: "$totalAmount",
        taskerId: { $ifNull: ["$taskerId", ""] },
        taskerName: {
          $ifNull: ["$taskerUser.name", { $ifNull: ["$taskerName", "Unassigned"] }],
        },
        taskerEmail: { $ifNull: ["$taskerUser.email", ""] },
        taskerPhone: { $ifNull: ["$tasker.phone", ""] },
        userName: { $ifNull: ["$customer.name", "Unknown customer"] },
        userEmail: { $ifNull: ["$customer.email", ""] },
        acceptedAt: "$acceptedAt",
        createdAt: "$createdAt",
      },
    },
  ]);

  return rows.map((row) => ({
    id: row.id,
    taskType: row.taskType || "others",
    description: row.description || row.taskType || "Task",
    location: row.location || "Unknown location",
    status: row.status || "pending",
    totalAmount: row.totalAmount || 0,
    taskerId: row.taskerId || "",
    taskerName: row.taskerName || "Unassigned",
    taskerEmail: row.taskerEmail || "",
    taskerPhone: row.taskerPhone || "",
    userName: row.userName || "Unknown customer",
    userEmail: row.userEmail || "",
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }));
}

async function getFailedSettlements() {
  const rows = await Order.aggregate<{
    id: string;
    orderDescription?: string;
    taskType?: string;
    location?: string;
    amount?: number;
    store?: string;
    status?: string;
    customerName?: string;
    customerEmail?: string;
    taskerId?: string;
    taskerName?: string;
    taskerEmail?: string;
    taskerPhone?: string;
    acceptedAt?: Date | null;
    createdAt?: Date | null;
    settlementFailureReason?: string;
    paymentStatus?: string;
    settlementStatus?: string;
  }>([
    { $match: { settlementStatus: "failed" } },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    { $limit: 50 },
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
        from: "user",
        localField: "userObjectId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
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
        id: { $toString: "$_id" },
        orderDescription: { $ifNull: ["$description", "$taskType"] },
        taskType: "$taskType",
        location: "$location",
        amount: "$amount",
        store: { $ifNull: ["$store", ""] },
        status: "$status",
        customerName: {
          $ifNull: ["$customer.name", { $ifNull: ["$customerName", "Unknown customer"] }],
        },
        customerEmail: { $ifNull: ["$customer.email", ""] },
        taskerId: { $ifNull: ["$taskerId", ""] },
        taskerName: {
          $ifNull: ["$taskerUser.name", { $ifNull: ["$taskerName", "Unassigned"] }],
        },
        taskerEmail: { $ifNull: ["$taskerUser.email", ""] },
        taskerPhone: { $ifNull: ["$tasker.phone", ""] },
        acceptedAt: "$acceptedAt",
        createdAt: "$createdAt",
        settlementFailureReason: { $ifNull: ["$settlementFailureReason", "No failure reason recorded"] },
        paymentStatus: { $ifNull: ["$paymentStatus", "unpaid"] },
        settlementStatus: { $ifNull: ["$settlementStatus", "failed"] },
      },
    },
  ]);

  return rows.map((row) => ({
    id: row.id,
    orderDescription: row.orderDescription || row.taskType || "Task",
    taskType: row.taskType || "others",
    location: row.location || "Unknown location",
    amount: row.amount || 0,
    store: row.store || "Not set",
    status: row.status || "pending",
    customerName: row.customerName || "Unknown customer",
    customerEmail: row.customerEmail || "",
    taskerId: row.taskerId || "",
    taskerName: row.taskerName || "Unassigned",
    taskerEmail: row.taskerEmail || "",
    taskerPhone: row.taskerPhone || "",
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    description: row.orderDescription || row.taskType || "Task",
    settlementFailureReason: row.settlementFailureReason || "No failure reason recorded",
    paymentStatus: row.paymentStatus || "unpaid",
    settlementStatus: row.settlementStatus || "failed",
  }));
}

async function getSupportTickets() {
  const tickets = await Support.find()
    .sort({ createdAt: -1 })
    .limit(40)
    .populate({
      path: "taskerId",
      select: "userId phone",
      populate: { path: "userId", select: "name email" },
    })
    .lean();

  return tickets.map((ticket) => {
    const tasker = ticket.taskerId as unknown as {
      _id?: Types.ObjectId;
      phone?: string;
      userId?: { name?: string; email?: string };
    };

    return {
      id: ticket._id.toString(),
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      taskerName: tasker?.userId?.name || "Unknown tasker",
      taskerEmail: tasker?.userId?.email || "",
      taskerPhone: tasker?.phone || "",
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  });
}

export async function GET(request: NextRequest) {
  const resource = normalizeResource(request.nextUrl.searchParams.get("resource"));
  if (!resource) return badResource();

  const access = await getExcoAccess(request.headers);
  if (!access.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccess(resource, access.excoRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  if (resource === "taskers") return NextResponse.json({ items: await getTaskers() });
  if (resource === "dry-cleaners") return NextResponse.json({ items: await getDryCleaners() });
  if (resource === "reviews") return NextResponse.json({ items: await getReviews() });
  if (resource === "orders") return NextResponse.json({ items: await getOrders() });
  if (resource === "failed-settlements") {
    return NextResponse.json({ items: await getFailedSettlements() });
  }
  if (resource === "users") {
    return NextResponse.json({ items: await getUsers(access.excoRole as ExcoRole) });
  }

  return NextResponse.json({ items: await getSupportTickets() });
}

export async function PATCH(request: NextRequest) {
  const resource = normalizeResource(request.nextUrl.searchParams.get("resource"));
  if (!resource) return badResource();

  const access = await getExcoAccess(request.headers);
  if (!access.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccess(resource, access.excoRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  await connectDB();

  if (resource === "taskers") {
    const { id, action, bankDetails } = body as {
      id?: string;
      action?: string;
      bankDetails?: { bankName?: string; accountNumber?: string; accountName?: string };
    };
    const hasBankDetails = bankDetails !== undefined;

    if (
      !id ||
      (action && !["approve", "reject", "suspend", "activate"].includes(action)) ||
      (!action && !hasBankDetails)
    ) {
      return NextResponse.json({ error: "Invalid tasker action" }, { status: 400 });
    }

    if (action && access.excoRole !== "COO") {
      return NextResponse.json({ error: "Only COO can change tasker approval status" }, { status: 403 });
    }

    const tasker = await Tasker.findById(id);
    if (!tasker) return NextResponse.json({ error: "Tasker not found" }, { status: 404 });

    if (action === "approve") {
      tasker.isVerified = true;
      tasker.isRejected = false;
    } else if (action === "reject") {
      tasker.isVerified = false;
      tasker.isRejected = true;
    } else if (action === "suspend") {
      tasker.isSettlementSuspended = true;
      tasker.settlementSuspendedAt = new Date();
    } else if (action === "activate") {
      tasker.isSettlementSuspended = false;
      tasker.settlementSuspendedAt = null;
    }

    if (hasBankDetails) {
      const nextBankDetails = {
        bankName: String(bankDetails?.bankName || "").trim(),
        accountNumber: String(bankDetails?.accountNumber || "").trim(),
        accountName: String(bankDetails?.accountName || "").trim(),
      };

      if (
        !nextBankDetails.bankName ||
        !/^\d{10}$/.test(nextBankDetails.accountNumber) ||
        !nextBankDetails.accountName
      ) {
        return NextResponse.json(
          { error: "Provide a bank name, 10-digit account number, and account name." },
          { status: 400 }
        );
      }

      tasker.bankDetails = nextBankDetails;
    }

    await tasker.save();
    return NextResponse.json({ ok: true });
  }

  if (resource === "dry-cleaners") {
    const { id, action } = body as { id?: string; action?: string };

    if (!id || !["approve", "reject", "close", "reopen"].includes(action || "")) {
      return NextResponse.json({ error: "Invalid dry cleaner action" }, { status: 400 });
    }

    if (access.excoRole !== "COO") {
      return NextResponse.json({ error: "Only COO can manage dry cleaners" }, { status: 403 });
    }

    const dryCleaner = await DryCleaner.findById(id);
    if (!dryCleaner) {
      return NextResponse.json({ error: "Dry cleaner not found" }, { status: 404 });
    }

    if (action === "approve") dryCleaner.status = "approved";
    if (action === "reject") dryCleaner.status = "rejected";
    if (action === "close") dryCleaner.availability.temporarilyClosed = true;
    if (action === "reopen") dryCleaner.availability.temporarilyClosed = false;

    await dryCleaner.save();
    return NextResponse.json({ ok: true });
  }

  if (resource === "orders") {
    const { id, action } = body as { id?: string; action?: string };

    if (!id || action !== "cancel") {
      return NextResponse.json({ error: "Invalid order action" }, { status: 400 });
    }

    if (access.excoRole !== "COO") {
      return NextResponse.json({ error: "Only COO can cancel tasks" }, { status: 403 });
    }

    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.status !== "in_progress") {
      return NextResponse.json({ error: "Only in-progress tasks can be cancelled here." }, { status: 400 });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    if (!order.hasPaid) {
      order.paymentStatus = "cancelled";
    }
    order.settlementStatus = "not_due";
    order.settlementReference = undefined;
    order.settlementAccessCode = undefined;
    order.settlementCheckoutUrl = undefined;
    order.settlementTransactionId = undefined;
    order.settlementInitializedAt = undefined;
    order.settlementPaidAt = undefined;
    order.settlementDueAt = undefined;
    order.settlementFailureReason = undefined;

    await order.save();
    emitOrderUpdated(order);
    return NextResponse.json({ ok: true });
  }

  if (resource === "failed-settlements") {
    const { id, action } = body as { id?: string; action?: string };

    if (!id || action !== "verify-settlement") {
      return NextResponse.json({ error: "Invalid settlement action" }, { status: 400 });
    }

    if (access.excoRole !== "CTO") {
      return NextResponse.json({ error: "Only CTO can verify failed settlements" }, { status: 403 });
    }

    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.settlementStatus !== "failed") {
      return NextResponse.json(
        { error: "Only failed settlements can be verified here." },
        { status: 400 }
      );
    }

    order.settlementStatus = "paid";
    order.taskerHasPaid = true;
    order.settlementPaidAt = new Date();
    order.settlementFailureReason = undefined;

    await order.save();
    if (order.taskerId) {
      await syncTaskerSettlementStatus(order.taskerId);
    }
    emitOrderUpdated(order);

    return NextResponse.json({ ok: true });
  }

  if (resource === "users") {
    const { id, phone, action, discountOrderCount } = body as {
      id?: string;
      phone?: string;
      action?: string;
      discountOrderCount?: number;
    };
    if (!id) return NextResponse.json({ error: "User id is required" }, { status: 400 });
    if (
      action &&
      !["verify", "suspend", "activate", "grant-discount", "remove-discount"].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid user action" }, { status: 400 });
    }

    const user = await User.findById(id).select(
      "role phone emailVerified isSuspended serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountGrantedAt serviceFeeDiscountRemainingOrders"
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "admin") {
      return NextResponse.json({ error: "Admin accounts cannot be modified" }, { status: 403 });
    }

    if (typeof phone === "string") {
      user.phone = phone.trim();
    }
    if (action === "verify") user.emailVerified = true;
    if (action === "suspend") user.isSuspended = true;
    if (action === "activate") user.isSuspended = false;
    if (action === "grant-discount") {
      const normalizedDiscountOrderCount = Number(discountOrderCount);

      if (
        !Number.isInteger(normalizedDiscountOrderCount) ||
        normalizedDiscountOrderCount < 1
      ) {
        return NextResponse.json(
          { error: "Enter how many upcoming orders should receive the discount." },
          { status: 400 }
        );
      }

      const grantorLookupConditions = getUserLookupConditions({
        id: access.userId,
        email: access.email,
      });
      const grantor = grantorLookupConditions.length
        ? await User.findOne({ $or: grantorLookupConditions })
            .select("name phone email")
            .lean()
        : null;
      const grantorPhone = typeof grantor?.phone === "string" ? grantor.phone.trim() : "";

      if (!grantorPhone) {
        return NextResponse.json(
          { error: "Add a phone number to your account before granting a discount." },
          { status: 400 }
        );
      }

      user.serviceFeeDiscountEnabled = true;
      user.serviceFeeDiscountGrantedByUserId = access.userId;
      user.serviceFeeDiscountGrantedByName =
        grantor?.name || access.email || "SwiftDU exco";
      user.serviceFeeDiscountGrantedByPhone = grantorPhone;
      user.serviceFeeDiscountGrantedAt = new Date();
      user.serviceFeeDiscountRemainingOrders = normalizedDiscountOrderCount;
    }
    if (action === "remove-discount") {
      await User.findByIdAndUpdate(id, {
        $set: {
          serviceFeeDiscountEnabled: false,
          serviceFeeDiscountRemainingOrders: 0,
        },
        $unset: {
          serviceFeeDiscountGrantedByUserId: "",
          serviceFeeDiscountGrantedByName: "",
          serviceFeeDiscountGrantedByPhone: "",
          serviceFeeDiscountGrantedAt: "",
        },
      });

      return NextResponse.json({ ok: true });
    }

    await user.save();
    return NextResponse.json({ ok: true });
  }

  if (resource === "support") {
    const { id, action } = body as { id?: string; action?: string };
    if (!id || !["start", "resolve", "close"].includes(action || "")) {
      return NextResponse.json({ error: "Invalid support action" }, { status: 400 });
    }

    const status = action === "start" ? "in-progress" : action === "resolve" ? "resolved" : "closed";
    const ticket = await Support.findByIdAndUpdate(id, { status }, { new: true });
    if (!ticket) return NextResponse.json({ error: "Support ticket not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "This resource is read-only" }, { status: 400 });
}
