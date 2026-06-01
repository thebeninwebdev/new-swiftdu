import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { notifyAdminsOfOrderEvent } from '@/lib/order-alerts';
import { Order } from '@/models/order';
import { User } from '@/models/user';
import { auth } from '@/lib/auth';
import { Review } from '@/models/review';
import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  normalizeRestaurantPeopleCount,
  normalizeRestaurantTakeawayCount,
  normalizeNoteSize,
  normalizePrintingServiceType,
  PRINTING_TASK_TYPE,
  RESTAURANT_MAX_PEOPLE,
  CAFE_INQUIRY_SERVICE_FEE,
  WATER_TASK_TYPE,
} from '@/lib/pricing';
import { splitServiceFee } from '@/lib/order-finance';
import {
  getUserLookupConditions,
  hasActiveServiceFeeDiscountReservation,
} from '@/lib/service-fee-discount';
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications';
import { createOrderTrackingToken } from '@/lib/order-tracking';

const ALLOWED_CUSTOMER_TASK_TYPES = new Set(['restaurant', 'printing', 'shopping', 'water', 'copy_notes']);

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      taskType,
      description,
      amount,
      location,
      store,
      packaging,
      restaurantPeopleCount,
      restaurantTakeawayCount,
      waterBags,
      noteSize,
      numberOfPages,
      printingServiceType,
      printingNeedsEditing,
      deadline,
      copyNotesType,
      copyNotesPages,
      deadlineDate,
      cafeInquiry,
    } = body;

    // Validation
    if (
      !taskType ||
      !location
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount);
    const normalizedDescription = String(description || '').trim();
    const normalizedTaskType = String(taskType || '').trim();
    const isCafeInquiry = normalizedTaskType === 'restaurant' && cafeInquiry === true;
    const parsedRestaurantPeopleCount =
      normalizedTaskType === 'restaurant' ? Number(restaurantPeopleCount || 1) : undefined;
    const normalizedRestaurantPeopleCount =
      normalizedTaskType === 'restaurant'
        ? normalizeRestaurantPeopleCount(parsedRestaurantPeopleCount)
        : undefined;
    const parsedRestaurantTakeawayCount =
      normalizedTaskType === 'restaurant' ? Number(restaurantTakeawayCount || 0) : undefined;
    const normalizedRestaurantTakeawayCount =
      normalizedTaskType === 'restaurant'
        ? normalizeRestaurantTakeawayCount(
            parsedRestaurantTakeawayCount,
            normalizedRestaurantPeopleCount
          )
        : undefined;
    const parsedWaterBags =
      normalizedTaskType === WATER_TASK_TYPE ? Number(waterBags) : undefined;
    const normalizedNoteSize = normalizeNoteSize(
      String(noteSize || copyNotesType || '').trim()
    );
    const parsedNumberOfPages =
      normalizedTaskType === 'copy_notes' || normalizedTaskType === PRINTING_TASK_TYPE
        ? Number(numberOfPages ?? copyNotesPages)
        : undefined;
    const normalizedPrintingServiceType =
      normalizedTaskType === PRINTING_TASK_TYPE
        ? normalizePrintingServiceType(String(printingServiceType || '').trim())
        : undefined;
    const normalizedPrintingNeedsEditing =
      normalizedTaskType === PRINTING_TASK_TYPE && Boolean(printingNeedsEditing);
    const parsedDeadline =
      normalizedTaskType === 'copy_notes' && (deadline || deadlineDate)
        ? new Date(String(deadline || deadlineDate).trim())
        : undefined;

    if (!ALLOWED_CUSTOMER_TASK_TYPES.has(normalizedTaskType)) {
      return NextResponse.json(
        { error: 'Select a valid task type.' },
        { status: 400 }
      );
    }

    if (
      normalizedTaskType !== 'copy_notes' &&
      normalizedTaskType !== PRINTING_TASK_TYPE &&
      normalizedTaskType !== WATER_TASK_TYPE &&
      !isCafeInquiry &&
      (amount === undefined ||
        amount === null ||
        amount === '' ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount < 0)
    ) {
      return NextResponse.json({ error: 'Enter a valid task amount' }, { status: 400 });
    }

    if (normalizedTaskType === 'copy_notes') {
      if (!normalizedNoteSize) {
        return NextResponse.json({ error: 'Choose the note size.' }, { status: 400 });
      }

      if (!Number.isInteger(parsedNumberOfPages) || (parsedNumberOfPages ?? 0) < 1) {
        return NextResponse.json({ error: 'Enter the number of pages.' }, { status: 400 });
      }

      if (
        !parsedDeadline ||
        Number.isNaN(parsedDeadline.getTime()) ||
        parsedDeadline.getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: 'Choose a future deadline for the copied notes.' },
          { status: 400 }
        );
      }
    }

    if (normalizedTaskType === PRINTING_TASK_TYPE) {
      if (!normalizedPrintingServiceType) {
        return NextResponse.json(
          { error: 'Choose printing or photocopying.' },
          { status: 400 }
        );
      }

      if (!Number.isInteger(parsedNumberOfPages) || (parsedNumberOfPages ?? 0) < 1) {
        return NextResponse.json(
          { error: 'Enter the number of pages.' },
          { status: 400 }
        );
      }
    }

    if (normalizedDescription && descriptionMentionsWater(normalizedDescription) && normalizedTaskType !== WATER_TASK_TYPE) {
      return NextResponse.json(
        {
          error:
            'Choose the bag of water task for water delivery.',
        },
        { status: 400 }
      );
    }

    if (normalizedTaskType === WATER_TASK_TYPE) {
      if (!Number.isInteger(parsedWaterBags) || (parsedWaterBags ?? 0) <= 0) {
        return NextResponse.json(
          { error: 'Enter the number of water bags for this delivery.' },
          { status: 400 }
        );
      }
    }

    if (
      normalizedTaskType === 'restaurant' &&
      (!Number.isInteger(parsedRestaurantPeopleCount) ||
        Number(parsedRestaurantPeopleCount) < 1 ||
        Number(parsedRestaurantPeopleCount) > RESTAURANT_MAX_PEOPLE)
    ) {
      return NextResponse.json(
        { error: `Restaurant food orders can only be for 1 to ${RESTAURANT_MAX_PEOPLE} people.` },
        { status: 400 }
      );
    }

    if (
      normalizedTaskType === 'restaurant' &&
      (!Number.isInteger(parsedRestaurantTakeawayCount) ||
        Number(parsedRestaurantTakeawayCount) < 0 ||
        Number(parsedRestaurantTakeawayCount) > Number(normalizedRestaurantPeopleCount || 1))
    ) {
      return NextResponse.json(
        { error: 'Choose how many restaurant orders need takeaway packs.' },
        { status: 400 }
      );
    }

    if (normalizedTaskType === 'shopping') {
      if (normalizedDescription.length < 5) {
        return NextResponse.json(
          { error: 'Describe the items you want.' },
          { status: 400 }
        );
      }

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: 'Enter a valid shopping budget.' },
          { status: 400 }
        );
      }
    }

    const pricing = calculateOrderPricing({
      amount:
        normalizedTaskType === 'copy_notes' || normalizedTaskType === WATER_TASK_TYPE
          ? 0
          : parsedAmount,
      taskType: normalizedTaskType,
      store: typeof store === 'string' ? store : undefined,
      restaurantPeopleCount: normalizedRestaurantPeopleCount,
      restaurantTakeawayCount: normalizedRestaurantTakeawayCount,
      cafeInquiry: isCafeInquiry,
      waterBags: parsedWaterBags,
      noteSize: normalizedNoteSize,
      numberOfPages: parsedNumberOfPages,
      printingServiceType: normalizedPrintingServiceType,
      printingNeedsEditing: normalizedPrintingNeedsEditing,
    });

    const customerLookupConditions = getUserLookupConditions(session.user);
    const customerAccount = customerLookupConditions.length
      ? await User.findOne({ $or: customerLookupConditions })
      .select(
        'serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders'
      )
      .lean()
      : null;
    let serviceFeeDiscountGrantedByName =
      customerAccount?.serviceFeeDiscountGrantedByName || undefined;
    let serviceFeeDiscountGrantedByPhone =
      customerAccount?.serviceFeeDiscountGrantedByPhone || undefined;

    if (
      customerAccount?.serviceFeeDiscountEnabled &&
      customerAccount?.serviceFeeDiscountGrantedByUserId &&
      !serviceFeeDiscountGrantedByPhone
    ) {
      const grantorLookupConditions = getUserLookupConditions({
        id: customerAccount.serviceFeeDiscountGrantedByUserId,
      });
      const grantor = grantorLookupConditions.length
        ? await User.findOne({ $or: grantorLookupConditions })
            .select('name phone email')
            .lean()
        : null;

      serviceFeeDiscountGrantedByName =
        serviceFeeDiscountGrantedByName ||
        grantor?.name ||
        grantor?.email ||
        undefined;
      serviceFeeDiscountGrantedByPhone =
        typeof grantor?.phone === 'string' && grantor.phone.trim()
          ? grantor.phone.trim()
          : undefined;

      if (serviceFeeDiscountGrantedByPhone) {
        await User.findOneAndUpdate(
          { $or: customerLookupConditions },
          {
            serviceFeeDiscountGrantedByName,
            serviceFeeDiscountGrantedByPhone,
          }
        );
      }
    }

    const baseSettlement =
      pricing.pricingModel === 'copy_notes' || pricing.pricingModel === 'water'
        ? {
            serviceFee: pricing.serviceFee,
            platformFee: pricing.platformFee || 0,
            taskerFee: pricing.taskerFee || 0,
          }
        : splitServiceFee(pricing.serviceFee);
    const hasDiscountReservation = await hasActiveServiceFeeDiscountReservation(session.user.id);
    const serviceFeeDiscountApplied = Boolean(
      customerAccount?.serviceFeeDiscountEnabled &&
        Number(customerAccount?.serviceFeeDiscountRemainingOrders || 0) > 0 &&
        !hasDiscountReservation &&
        pricing.serviceFee > 0
    );
    const discountCommissionAmount = serviceFeeDiscountApplied
      ? pricing.pricingModel === 'tiered'
        ? baseSettlement.taskerFee || pricing.serviceFee
        : pricing.serviceFee
      : 0;
    const settlement = serviceFeeDiscountApplied
      ? {
          serviceFee: 0,
          platformFee: 0,
          taskerFee: pricing.pricingModel === 'tiered' ? 0 : baseSettlement.taskerFee,
        }
      : baseSettlement;
    const totalAmount = serviceFeeDiscountApplied
      ? Math.max(0, pricing.totalAmount - pricing.serviceFee)
      : pricing.totalAmount;

    const bookedAt = new Date();

    const order = new Order({
      userId: session.user.id,
      source: 'website',
      trackingToken: createOrderTrackingToken(),
      taskType: normalizedTaskType,
      description: normalizedDescription,
      amount: pricing.amount,
      commission: settlement.serviceFee,
      platformFee: settlement.platformFee,
      taskerFee: settlement.taskerFee,
      serviceFee: settlement.serviceFee,
      serviceFeeBeforeDiscount: serviceFeeDiscountApplied ? pricing.serviceFee : undefined,
      serviceFeeDiscountApplied,
      serviceFeeDiscountGrantedByName: serviceFeeDiscountApplied
        ? serviceFeeDiscountGrantedByName
        : undefined,
      serviceFeeDiscountGrantedByPhone: serviceFeeDiscountApplied
        ? serviceFeeDiscountGrantedByPhone
        : undefined,
      discountCommissionAmount,
      pricingModel: pricing.pricingModel,
      totalAmount,
      location,
      store: normalizedTaskType === 'copy_notes' || normalizedTaskType === WATER_TASK_TYPE ? undefined : store || undefined,
      itemPrice: normalizedTaskType === 'restaurant' || normalizedTaskType === 'shopping' ? parsedAmount : undefined,
      packaging:
        normalizedTaskType === 'restaurant'
          ? pricing.restaurantTakeawayCount && pricing.restaurantTakeawayCount > 0
            ? pricing.restaurantTakeawayCount === pricing.restaurantPeopleCount
              ? 'Takeaway pack'
              : `${pricing.restaurantTakeawayCount} takeaway, ${Number(pricing.restaurantPeopleCount || 0) - pricing.restaurantTakeawayCount} cellophane`
            : 'Cellophane'
          : packaging || undefined,
      restaurantPeopleCount: pricing.restaurantPeopleCount,
      restaurantTakeawayCount: pricing.restaurantTakeawayCount,
      restaurantPackagingFee: pricing.restaurantPackagingFee || 0,
      cafeInquiry: isCafeInquiry,
      cafeInquiryFeePaid: false,
      cafeInquiryDetailsSubmitted: !isCafeInquiry,
      waterBags: pricing.waterBags || undefined,
      waterFee: pricing.waterFee,
      noteSize: pricing.noteSize,
      numberOfPages: pricing.numberOfPages,
      printingServiceType: pricing.printingServiceType,
      printingNeedsEditing: pricing.printingNeedsEditing,
      drawingPages: 0,
      deadline: normalizedTaskType === 'copy_notes' ? parsedDeadline : undefined,
      dueDate: normalizedTaskType === 'copy_notes' ? parsedDeadline : undefined,
      copyNotesType: pricing.copyNotesType,
      copyNotesPages: pricing.copyNotesPages,
      deadlineDate: normalizedTaskType === 'copy_notes' ? parsedDeadline : undefined,
      deadlineValue: undefined,
      deadlineUnit: undefined,
      status: 'pending',
      bookedAt,
      paymentProvider: 'manual_transfer',
      paymentStatus: 'unpaid',
      taskerHasPaid: false,
      settlementStatus: 'not_due',
    });

    await order.save();

    emitOrderUpdated(order);

    const taskerPushResult = await sendPushNotification({
      audience: { roles: ['tasker'] },
      title: 'New Task Available',
      body: isCafeInquiry
        ? `Cafe inquiry in ${location} - NGN ${CAFE_INQUIRY_SERVICE_FEE.toLocaleString()} service fee`
        : `${formatPushTaskType(normalizedTaskType)} in ${location} - NGN ${totalAmount.toLocaleString()}`,
      url: '/available-tasks',
      tag: `new-task-${order._id.toString()}`,
    });

    if (
      taskerPushResult.skipped ||
      taskerPushResult.deliveredCount + (taskerPushResult.expiredCount || 0) <
        taskerPushResult.recipientCount
    ) {
      console.warn('[Orders POST Tasker Push Notification]:', taskerPushResult);
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
        console.warn('[Orders POST Admin Notification]:', adminAlertResult);
      }
    } catch (notificationError) {
      console.error('[Orders POST Admin Notification Error]:', notificationError);
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('[Orders POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {

    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const currentOnly = searchParams.get('current') === 'true';
    const needsReview = searchParams.get('needsReview') === 'true';
    const limit = Number(searchParams.get('limit') || 0);
    const statusParam = searchParams.get('status');

    const query: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (currentOnly) {
      query.status = { $in: [...ACTIVE_ORDER_STATUSES] };
    } else if (statusParam) {
      const statuses = statusParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (statuses.length === 1) {
        query.status = statuses[0];
      } else if (statuses.length > 1) {
        query.status = { $in: statuses };
      }
    }

    if (currentOnly) {
      const order = await Order.findOne(query).sort({
        createdAt: -1,
      });
      return NextResponse.json(order);
    }

    let ordersQuery = Order.find(query).sort({
      createdAt: -1,
    });

    if (limit > 0) {
      ordersQuery = ordersQuery.limit(limit);
    }

    let orders = await ordersQuery.lean();

    if (needsReview) {
      const completedOrders = orders.filter((order) => order.status === 'completed');

      if (completedOrders.length === 0) {
        return NextResponse.json([]);
      }

      const orderIds = completedOrders.map((order) => order._id);
      const existingReviews = await Review.find({
        userId: session.user.id,
        orderId: { $in: orderIds },
      })
        .select('orderId')
        .lean();

      const reviewedOrderIds = new Set(
        existingReviews.map((review) => review.orderId.toString())
      );

      orders = completedOrders.filter(
        (order) => !reviewedOrderIds.has(order._id.toString())
      );
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error('[Orders GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
