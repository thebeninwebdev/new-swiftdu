import { NextResponse, type NextRequest } from "next/server";

import { connectDB } from "@/lib/db";
import { getExcoAccess } from "@/lib/exco";
import { splitServiceFee } from "@/lib/order-finance";
import { calculateOrderPricing } from "@/lib/pricing";
import { emitOrderUpdated } from "@/lib/socket";
import { Order } from "@/models/order";

const TEST_ORDER_AMOUNT = 1500;
const TEST_ORDER_LOCATION = "SwiftDU Test Location";
const TEST_ORDER_STORE = "SwiftDU QA Kitchen";

export async function POST(request: NextRequest) {
  try {
    const access = await getExcoAccess(request.headers);

    if (!access.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!access.excoRole || !access.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const pricing = calculateOrderPricing({
      amount: TEST_ORDER_AMOUNT,
      taskType: "restaurant",
      store: TEST_ORDER_STORE,
      restaurantPeopleCount: 1,
      restaurantTakeawayCount: 0,
    });
    const settlement = splitServiceFee(pricing.serviceFee);
    const bookedAt = new Date();

    const order = new Order({
      userId: access.userId,
      source: "website",
      taskType: "restaurant",
      description: `Test order created from ${access.excoRole} dashboard`,
      amount: pricing.amount,
      itemPrice: TEST_ORDER_AMOUNT,
      commission: settlement.serviceFee,
      platformFee: settlement.platformFee,
      taskerFee: settlement.taskerFee,
      serviceFee: settlement.serviceFee,
      pricingModel: pricing.pricingModel,
      totalAmount: pricing.totalAmount,
      location: TEST_ORDER_LOCATION,
      store: TEST_ORDER_STORE,
      packaging: "Cellophane",
      restaurantPeopleCount: pricing.restaurantPeopleCount,
      restaurantTakeawayCount: pricing.restaurantTakeawayCount,
      restaurantPackagingFee: pricing.restaurantPackagingFee || 0,
      cafeInquiry: false,
      cafeInquiryFeePaid: false,
      cafeInquiryDetailsSubmitted: true,
      drawingPages: 0,
      status: "pending",
      bookedAt,
      paymentProvider: "manual_transfer",
      paymentStatus: "unpaid",
      taskerHasPaid: false,
      settlementStatus: "not_due",
      isTestOrder: true,
      testOrderCreatedBy: access.userId,
      testOrderCreatedByRole: access.excoRole,
    });

    await order.save();

    // Test orders should be visible in realtime but must not trigger Telegram/admin alerts.
    emitOrderUpdated(order);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/exco/test-order]", error);
    return NextResponse.json(
      { error: "Failed to create test order" },
      { status: 500 }
    );
  }
}
