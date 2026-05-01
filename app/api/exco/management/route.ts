import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";

import { getExcoAccess, type ExcoRole } from "@/lib/exco";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/order";
import { Review } from "@/models/review";
import Support from "@/models/support";
import Tasker from "@/models/tasker";
import { User } from "@/models/user";

type Resource = "taskers" | "reviews" | "users" | "support";

const RESOURCE_ACCESS: Record<Resource, ExcoRole[]> = {
  taskers: ["COO"],
  reviews: ["COO"],
  users: ["COO", "CTO"],
  support: ["CTO"],
};

function canAccess(resource: Resource, role: ExcoRole | null) {
  return Boolean(role && RESOURCE_ACCESS[resource].includes(role));
}

function normalizeResource(value: string | null): Resource | null {
  if (value === "taskers" || value === "reviews" || value === "users" || value === "support") {
    return value;
  }

  return null;
}

function badResource() {
  return NextResponse.json({ error: "Invalid management resource" }, { status: 400 });
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
    isPremium: tasker.isPremium,
    isSettlementSuspended: Boolean(tasker.isSettlementSuspended),
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
    .select("_id name email phone role emailVerified isSuspended createdAt")
    .lean();

  const userIds = users.map((user) => user._id.toString());
  const orderCounts = await Order.aggregate<{ _id: string; count: number }>([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  const orderCountMap = Object.fromEntries(orderCounts.map((item) => [item._id, item.count]));

  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    emailVerified: user.emailVerified,
    isSuspended: Boolean(user.isSuspended),
    orderCount: orderCountMap[user._id.toString()] || 0,
    createdAt: user.createdAt,
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
  if (resource === "reviews") return NextResponse.json({ items: await getReviews() });
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
    const { id, action } = body as { id?: string; action?: string };
    if (!id || !["approve", "reject", "suspend", "activate"].includes(action || "")) {
      return NextResponse.json({ error: "Invalid tasker action" }, { status: 400 });
    }

    const tasker = await Tasker.findById(id);
    if (!tasker) return NextResponse.json({ error: "Tasker not found" }, { status: 404 });

    if (action === "approve") {
      tasker.isVerified = true;
      tasker.isRejected = false;
    } else if (action === "reject") {
      tasker.isVerified = false;
      tasker.isRejected = true;
      tasker.isPremium = false;
    } else if (action === "suspend") {
      tasker.isSettlementSuspended = true;
      tasker.settlementSuspendedAt = new Date();
    } else if (action === "activate") {
      tasker.isSettlementSuspended = false;
      tasker.settlementSuspendedAt = null;
    }

    await tasker.save();
    return NextResponse.json({ ok: true });
  }

  if (resource === "users") {
    const { id, phone, action } = body as { id?: string; phone?: string; action?: string };
    if (!id) return NextResponse.json({ error: "User id is required" }, { status: 400 });
    if (
      action &&
      !["verify", "suspend", "activate"].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid user action" }, { status: 400 });
    }

    const user = await User.findById(id).select("role phone emailVerified isSuspended");
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
