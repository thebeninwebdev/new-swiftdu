import { NextRequest, NextResponse } from 'next/server';

import { connectDB } from '@/lib/db';
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
    const order = await Order.findOne({ trackingToken: token, source: 'whatsapp' }).lean();

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
