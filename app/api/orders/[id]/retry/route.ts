import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { notifyAdminsOfOrderEvent } from '@/lib/order-alerts';
import { emitOrderUpdated } from '@/lib/socket';
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications';
import {
  getUserLookupConditions,
  hasActiveServiceFeeDiscountReservation,
} from '@/lib/service-fee-discount';
import { CAFE_INQUIRY_SERVICE_FEE, CAFE_INQUIRY_EXTRA_FEE } from '@/lib/pricing';
import { splitServiceFee } from '@/lib/order-finance';
import {
  getCreatedInMode,
  shouldCreateTestOrder,
  shouldSendOrderNotification,
} from '@/lib/test-orders';
import { Order } from '@/models/order';
import { User } from '@/models/user';
import { canCreateOrder, OPERATIONS_SUSPENDED } from '@/lib/operations';

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

    if (order.status !== 'cancelled' && order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed or cancelled tasks can be retried.' },
        { status: 400 }
      );
    }

    const bookedAt = new Date();
    const customerLookupConditions = getUserLookupConditions({ id: session.user.id });
    const customerAccount = customerLookupConditions.length
      ? await User.findOne({ $or: customerLookupConditions })
          .select(
            'isExco excoRole testOrderMode serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders'
          )
          .lean()
      : null;
    const isTestOrder = shouldCreateTestOrder(customerAccount || undefined);
    if (!canCreateOrder(isTestOrder)) {
      return NextResponse.json(OPERATIONS_SUSPENDED, { status: 503 });
    }

    const hasDiscountReservation = await hasActiveServiceFeeDiscountReservation(session.user.id);
    const fullServiceFee = order.cafeInquiry ? CAFE_INQUIRY_SERVICE_FEE : Number(
      order.serviceFeeBeforeDiscount || order.serviceFee || order.commission || 0
    );
    const serviceFeeDiscountApplied = Boolean(
      customerAccount?.serviceFeeDiscountEnabled &&
        Number(customerAccount.serviceFeeDiscountRemainingOrders || 0) > 0 &&
        !hasDiscountReservation &&
        fullServiceFee > 0
    );
    const tieredSettlement = splitServiceFee(fullServiceFee);
    const discountCommissionAmount = serviceFeeDiscountApplied
      ? order.pricingModel === 'tiered'
        ? order.cafeInquiry ? splitServiceFee(fullServiceFee - CAFE_INQUIRY_EXTRA_FEE).taskerFee : Number(order.taskerFee || tieredSettlement.taskerFee || fullServiceFee)
        : fullServiceFee
      : 0;
    const retriedServiceFee = fullServiceFee;
    const retriedPlatformFee = order.cafeInquiry ? tieredSettlement.platformFee :
      Number(order.platformFee || 0) ||
      (order.pricingModel === 'tiered'
        ? tieredSettlement.platformFee
        : fullServiceFee);
    const retriedTaskerFee = order.cafeInquiry ? tieredSettlement.taskerFee :
      Number(order.taskerFee || 0) ||
      (order.pricingModel === 'tiered' ? tieredSettlement.taskerFee : 0);
    const fullTotalAmount = order.cafeInquiry ? fullServiceFee :
      Number(order.totalAmount || 0) +
      (order.serviceFeeDiscountApplied ? fullServiceFee : 0);
    const retriedTotalAmount = serviceFeeDiscountApplied
      ? Math.max(0, fullTotalAmount - fullServiceFee + (order.cafeInquiry ? CAFE_INQUIRY_EXTRA_FEE : 0))
      : fullTotalAmount;

    const retriedOrder = new Order({
      userId: order.userId,
      source: order.source,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      taskType: order.taskType,
      description: order.cafeInquiry ? 'Text me what is in cafe' : order.description,
      amount: order.cafeInquiry ? 0 : order.amount,
      itemPrice: order.cafeInquiry ? 0 : order.itemPrice,
      commission: retriedServiceFee,
      platformFee: retriedPlatformFee,
      taskerFee: retriedTaskerFee,
      serviceFee: retriedServiceFee,
      serviceFeeBeforeDiscount: serviceFeeDiscountApplied ? fullServiceFee : undefined,
      serviceFeeDiscountApplied,
      serviceFeeDiscountGrantedByName: serviceFeeDiscountApplied
        ? customerAccount?.serviceFeeDiscountGrantedByName || undefined
        : undefined,
      serviceFeeDiscountGrantedByPhone: serviceFeeDiscountApplied
        ? customerAccount?.serviceFeeDiscountGrantedByPhone || undefined
        : undefined,
      discountCommissionAmount,
      pricingModel: order.pricingModel,
      totalAmount: retriedTotalAmount,
      location: order.location,
      deliveryLocation: order.deliveryLocation,
      store: order.store,
      packaging: order.cafeInquiry ? undefined : order.packaging,
      restaurantPeopleCount: order.cafeInquiry ? 1 : order.restaurantPeopleCount,
      restaurantTakeawayCount: order.cafeInquiry ? 0 : order.restaurantTakeawayCount,
      restaurantPackagingFee: order.restaurantPackagingFee,
      cafeInquiry: order.cafeInquiry,
      cafeInquiryStatus: order.cafeInquiry ? 'waiting_for_tasker' : undefined,
      cafeInquiryFeePaid: false,
      cafeInquiryDetailsSubmitted: order.cafeInquiry ? false : order.cafeInquiryDetailsSubmitted,
      waterBags: order.waterBags,
      waterFee: order.waterFee,
      indomiePacks: order.indomiePacks,
      eggCount: order.eggCount,
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
      isTestOrder,
      createdInMode: getCreatedInMode(isTestOrder),
      testOrderCreatedBy: isTestOrder ? session.user.id : undefined,
      testOrderCreatedByRole: isTestOrder
        ? customerAccount?.excoRole || session.user.role || 'exco'
        : undefined,
    });

    await retriedOrder.save();

    emitOrderUpdated(retriedOrder);

    if (shouldSendOrderNotification(retriedOrder)) {
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
    }

    if (shouldSendOrderNotification(retriedOrder)) {
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
