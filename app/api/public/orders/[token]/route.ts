import { NextRequest, NextResponse } from 'next/server';

import { connectDB } from '@/lib/db';
import { emitOrderUpdated } from '@/lib/socket';
import { Order } from '@/models/order';
import Tasker from '@/models/tasker';

function serializeDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeOrder(order: any, tasker: any | null) {
  return {
    _id: order._id.toString(),
    source: order.source,
    taskType: order.taskType,
    description: order.description || '',
    amount: Number(order.amount || 0),
    commission: Number(order.commission || order.serviceFee || 0),
    platformFee: Number(order.platformFee || 0),
    serviceFee: Number(order.serviceFee || order.commission || 0),
    totalAmount: Number(order.totalAmount || order.amount || 0),
    location: order.location || '',
    deliveryLocation: order.deliveryLocation || '',
    store: order.store || '',
    status: order.status,
    taskerId: order.taskerId || null,
    taskerName: order.taskerName || null,
    acceptedAt: serializeDate(order.acceptedAt),
    bookedAt: serializeDate(order.bookedAt),
    createdAt: serializeDate(order.createdAt),
    updatedAt: serializeDate(order.updatedAt),
    completedAt: serializeDate(order.completedAt),
    cancelledAt: serializeDate(order.cancelledAt),
    hasPaid: Boolean(order.hasPaid),
    isDeclinedTask: Boolean(order.isDeclinedTask),
    declinedMessage: order.declinedMessage || '',
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentFailureReason: order.paymentFailureReason || '',
    cafeInquiry: Boolean(order.cafeInquiry),
    cafeInquiryFeePaid: Boolean(order.cafeInquiryFeePaid),
    cafeInquiryDetailsSubmitted: Boolean(order.cafeInquiryDetailsSubmitted),
    tasker: tasker
      ? {
          name: order.taskerName || 'Tasker',
          phone: tasker.phone || '',
          profileImage: tasker.profileImage || null,
          bankDetails: {
            bankName: tasker.bankDetails?.bankName || '',
            accountName: tasker.bankDetails?.accountName || '',
            accountNumber: tasker.bankDetails?.accountNumber || '',
          },
        }
      : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();

    const { token } = await params;
    const order = await Order.findOne({ trackingToken: token }).lean();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const tasker = order.taskerId
      ? await Tasker.findById(order.taskerId).select('phone profileImage bankDetails').lean()
      : null;

    return NextResponse.json({ order: serializeOrder(order, tasker) });
  } catch (error) {
    console.error('[GET /api/public/orders/[token]]', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();

    const { token } = await params;
    const order = await Order.findOne({ trackingToken: token });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (
      !order.cafeInquiry ||
      !order.cafeInquiryFeePaid ||
      order.cafeInquiryDetailsSubmitted
    ) {
      return NextResponse.json(
        { error: 'This order is not waiting for cafe details.' },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json({ error: 'This order is no longer active.' }, { status: 400 });
    }

    const body = await request.json();
    const description = String(body.description || '').trim();
    const amount = Number(body.amount);

    if (description.length < 5) {
      return NextResponse.json(
        { error: 'Describe the food you want to buy.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid food budget.' }, { status: 400 });
    }

    order.description = description;
    order.amount = amount;
    order.itemPrice = amount;
    order.totalAmount = amount;
    order.cafeInquiryDetailsSubmitted = true;
    order.hasPaid = false;
    order.paidAt = undefined;
    order.paymentStatus = 'unpaid';
    order.paymentFailureReason = undefined;
    order.customerTransferredAt = undefined;

    await order.save();
    emitOrderUpdated(order);

    const tasker = order.taskerId
      ? await Tasker.findById(order.taskerId).select('phone profileImage bankDetails').lean()
      : null;

    return NextResponse.json({ order: serializeOrder(order, tasker) });
  } catch (error) {
    console.error('[PATCH /api/public/orders/[token]]', error);
    return NextResponse.json({ error: 'Failed to update cafe order details.' }, { status: 500 });
  }
}
