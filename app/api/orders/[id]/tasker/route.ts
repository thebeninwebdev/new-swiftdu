import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/order";
import Tasker from "@/models/tasker";
import { User } from "@/models/user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const order = await Order.findById(id).lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this order" },
        { status: 403 }
      );
    }

    if (!order.taskerId) {
      return NextResponse.json(
        { error: "No tasker has been assigned to this order yet" },
        { status: 404 }
      );
    }

    const tasker = await Tasker.findById(order.taskerId).lean();

    if (!tasker) {
      return NextResponse.json({ error: "Tasker not found" }, { status: 404 });
    }

    const taskerUser = await User.findById(tasker.userId)
      .select("name")
      .lean();

    return NextResponse.json({
      _id: tasker._id,
      name: taskerUser?.name || order.taskerName || "Tasker",
      phone: tasker.phone,
      profileImage: tasker.profileImage || null,
      bankDetails: tasker.bankDetails,
    });
  } catch (error) {
    console.error("[GET /api/orders/[id]/tasker]", error);
    return NextResponse.json(
      { error: "Failed to fetch tasker details" },
      { status: 500 }
    );
  }
}
