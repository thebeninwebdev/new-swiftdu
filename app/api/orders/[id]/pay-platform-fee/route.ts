import { NextRequest, NextResponse } from "next/server";
import { Order } from "@/models/order";
import { connectDB } from "@/lib/db";

// TODO: Replace with real Paystack verification logic
// async function verifyPaystack(reference: string): Promise<boolean> {
//   // Call Paystack API to verify payment
//   // For now, always return true (stub)
//   return !!reference;
// }

export async function POST(req: NextRequest,   { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  try {
    const { reference } = await req.json();
    if (!reference) {
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }
    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    // Verify payment with Paystack
    // const verified = await verifyPaystack(reference);
    // if (!verified) {
    //   return NextResponse.json({ error: "Payment not verified" }, { status: 402 });
    // }
    // Mark platform fee as paid
    order.taskerHasPaid = true;
    await order.save();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 });
  }
}
