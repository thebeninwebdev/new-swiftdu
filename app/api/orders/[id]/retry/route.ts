import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { notifyAdminsOfOrderEvent } from '@/lib/order-alerts';
import { emitOrderUpdated } from '@/lib/socket';
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications';
import { Order } from '@/models/order';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      );
    }

    if (order.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only cancelled tasks can be retried.' },
        { status: 400 }
      );
    }

    if (order.hasPaid || order.paymentStatus === 'paid') {
      return NextResponse.json(
        { error: 'Paid tasks cannot be retried from here.' },
        { status: 400 }
      );
    }

    const bookedAt = new Date();

    order.status = 'pending';
    order.bookedAt = bookedAt;
    order.cancelledAt = undefined;
    order.taskerId = undefined;
    order.taskerName = undefined;
    order.acceptedBy = undefined;
    order.acceptedAt = undefined;
    order.paidAt = undefined;
    order.completedAt = undefined;
    order.hasPaid = false;
    order.isDeclinedTask = false;
    order.declinedAt = undefined;
    order.declinedReason = undefined;
    order.declinedMessage = undefined;
    order.declinedByTaskerAt = undefined;
    order.paymentStatus = 'unpaid';
    order.paymentReference = undefined;
    order.paymentLink = undefined;
    order.paymentTransactionId = undefined;
    order.paymentInitializedAt = undefined;
    order.paymentVerifiedAt = undefined;
    order.paymentFailureReason = undefined;
    order.customerTransferredAt = undefined;
    order.taskerHasPaid = false;
    order.settlementStatus = 'not_due';
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

    const taskerPushResult = await sendPushNotification({
      audience: { roles: ['tasker'] },
      title: 'New Task Available',
      body: `${formatPushTaskType(order.taskType)} in ${order.location} - NGN ${Number(
        order.totalAmount || 0
      ).toLocaleString()}`,
      url: '/available-tasks',
      tag: `retry-task-${order._id.toString()}-${bookedAt.getTime()}`,
    });

    if (
      taskerPushResult.skipped ||
      taskerPushResult.deliveredCount + (taskerPushResult.expiredCount || 0) <
        taskerPushResult.recipientCount
    ) {
      console.warn('[Orders Retry Tasker Push Notification]:', taskerPushResult);
    }

    try {
      const adminAlertResult = await notifyAdminsOfOrderEvent({
        event: 'created',
        order,
        actorName: session.user.name || null,
        actorEmail: session.user.email || null,
        actorRole: 'customer',
      });

      if (
        adminAlertResult.skipped ||
        adminAlertResult.deliveredCount < adminAlertResult.recipientCount
      ) {
        console.warn('[Orders Retry Admin Notification]:', adminAlertResult);
      }
    } catch (notificationError) {
      console.error('[Orders Retry Admin Notification Error]:', notificationError);
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Orders Retry Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retry task' },
      { status: 500 }
    );
  }
}
