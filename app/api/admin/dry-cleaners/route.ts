import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import DryCleaner, { type DryCleanerStatus } from "@/models/dry-cleaner";
import { User } from "@/models/user";

function normalizeStatus(value: string | null): DryCleanerStatus | null {
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const status = normalizeStatus(new URL(req.url).searchParams.get("status"));
    const filter = status ? { status } : {};

    const dryCleaners = await DryCleaner.find(filter).sort({ createdAt: -1 }).lean();
    const userIds = dryCleaners.map((dryCleaner) => dryCleaner.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email")
      .lean();

    const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user]));

    return NextResponse.json({
      dryCleaners: dryCleaners.map((dryCleaner) => ({
        ...dryCleaner,
        user: userMap[dryCleaner.userId.toString()] ?? null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/dry-cleaners]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
