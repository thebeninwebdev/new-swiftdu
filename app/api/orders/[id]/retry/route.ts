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

    const retriedOrder = new Order({
      userId: order.userId,
      source: order.source,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      taskType: order.taskType,
      description: order.description,
      amount: order.amount,
      itemPrice: order.itemPrice,
      commission: order.commission,
      platformFee: order.platformFee,
      taskerFee: order.taskerFee,
      serviceFee: order.serviceFee,
      pricingModel: order.pricingModel,
      totalAmount: order.totalAmount,
      location: order.location,
      deliveryLocation: order.deliveryLocation,
      store: order.store,
      packaging: order.packaging,
      restaurantPeopleCount: order.restaurantPeopleCount,
      restaurantTakeawayCount: order.restaurantTakeawayCount,
      restaurantPackagingFee: order.restaurantPackagingFee,
      cafeInquiry: order.cafeInquiry,
      cafeInquiryFeePaid: false,
      cafeInquiryDetailsSubmitted: order.cafeInquiryDetailsSubmitted,
      waterBags: order.waterBags,
      waterFee: order.waterFee,
      noteSize: order.noteSize,
      numberOfPages: order.numberOfPages,
      printingServiceType: order.printingServiceType,
      printingNeedsEditing: order.printingNeedsEditing,
      drawingPages: order.drawingPages,
      deadline: order.deadline,
      dueDate: order.dueDate,
      copyNotesType: order.copyNotesType,
      copyNotesPages: order.copyNotesPages,
      deadlineDate: order.deadlineDate,
      deadlineValue: order.deadlineValue,
      deadlineUnit: order.deadlineUnit,
      status: 'pending',
      bookedAt,
      hasPaid: false,
      taskerHasPaid: false,
      isDeclinedTask: false,
      paymentProvider: 'manual_transfer',
      paymentStatus: 'unpaid',
      settlementStatus: 'not_due',
    });

    await retriedOrder.save();

    emitOrderUpdated(retriedOrder);

    const taskerPushResult = await sendPushNotification({
      audience: { roles: ['tasker'] },
      title: 'New Task Available',
      body: `${formatPushTaskType(retriedOrder.taskType)} in ${retriedOrder.location} - NGN ${Number(
        retriedOrder.totalAmount || 0
      ).toLocaleString()}`,
      url: '/available-tasks',
      tag: `new-task-${retriedOrder._id.toString()}`,
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
        order: retriedOrder,
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

    return NextResponse.json(retriedOrder, { status: 201 });
  } catch (error) {
    console.error('[Orders Retry Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retry task' },
      { status: 500 }
    );
  }
}
