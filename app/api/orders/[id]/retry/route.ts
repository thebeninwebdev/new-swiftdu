import { validateDeliveryRoom } from '@/lib/delivery-policy';
import { saveNewOrderWithBonus } from '@/lib/first-order-bonus';
import { calculateOrderPricing } from '@/lib/pricing';
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
import { CAFE_INQUIRY_EXTRA_FEE } from '@/lib/pricing';
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

    if (order.taskType === 'copy_notes') {
      return NextResponse.json(
        { error: 'Copying notes is no longer available. Please choose another task.' },
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
    // Reposts always start with today's normal price, never a discounted snapshot.
    const pricing = calculateOrderPricing({
      ...order.toObject(), amount: order.cafeInquiry ? 0 : Number(order.itemPrice ?? order.amount),
      restaurantPeopleCount: order.cafeInquiry ? 1 : order.restaurantPeopleCount,
      restaurantTakeawayCount: order.cafeInquiry ? 0 : order.restaurantTakeawayCount,
    });
    const fullServiceFee = pricing.serviceFee;
    const serviceFeeDiscountApplied = Boolean(
      customerAccount?.serviceFeeDiscountEnabled &&
        Number(customerAccount.serviceFeeDiscountRemainingOrders || 0) > 0 &&
        !hasDiscountReservation &&
        fullServiceFee > 0
    );
    const normalFees = pricing.pricingModel === 'tiered' ? splitServiceFee(fullServiceFee) : { platformFee: pricing.platformFee || 0, taskerFee: pricing.taskerFee || 0 };
    const discountCommissionAmount = serviceFeeDiscountApplied
      ? pricing.pricingModel === 'tiered'
        ? order.cafeInquiry ? splitServiceFee(fullServiceFee - CAFE_INQUIRY_EXTRA_FEE).taskerFee : normalFees.taskerFee
        : fullServiceFee
      : 0;

    try { validateDeliveryRoom(order.location, order.roomNumber); } catch (error) {
      return NextResponse.json({ error: (error as Error).message + ' Create a new order with your room number.' }, { status: 400 });
    }
    const retriedOrder = new Order({
      userId: order.userId,
      source: order.source,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      taskType: order.taskType,
      description: order.cafeInquiry ? 'Text me what is in cafe' : order.description,
      amount: pricing.amount,
      itemPrice: order.cafeInquiry ? 0 : order.itemPrice,
      commission: fullServiceFee,
      platformFee: normalFees.platformFee,
      taskerFee: normalFees.taskerFee,
      serviceFee: fullServiceFee,
      serviceFeeBeforeDiscount: serviceFeeDiscountApplied ? fullServiceFee : undefined,
      serviceFeeDiscountApplied,
      serviceFeeDiscountGrantedByName: serviceFeeDiscountApplied
        ? customerAccount?.serviceFeeDiscountGrantedByName || undefined
        : undefined,
      serviceFeeDiscountGrantedByPhone: serviceFeeDiscountApplied
        ? customerAccount?.serviceFeeDiscountGrantedByPhone || undefined
        : undefined,
      discountCommissionAmount,
      pricingModel: pricing.pricingModel,
      totalAmount: pricing.totalAmount,
      location: order.location,
      roomNumber: order.roomNumber,
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
      waterFee: pricing.waterFee,
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

    await saveNewOrderWithBonus(retriedOrder, pricing);

    emitOrderUpdated(retriedOrder);

    if (shouldSendOrderNotification(retriedOrder)) {
      const taskerPushResult = await sendPushNotification({
        audience: { roles: ['tasker'], taskerGenderRestriction: retriedOrder.taskerGenderRestriction || null },
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
