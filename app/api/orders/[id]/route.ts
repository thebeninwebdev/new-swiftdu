import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { syncTaskerStats } from '@/lib/tasker-stats';
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement';
import {Order} from "@/models/order"
import { auth } from '@/lib/auth'; 
import { canCustomerCancelOrder, canTaskerCancelOrder } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';
import { ensureCompletionTimer } from '@/lib/completion-timer';
import { getSettlementDueAt, splitServiceFee } from '@/lib/order-finance';
import { ensureBookedAt } from '@/lib/order-response-time';
import { consumeServiceFeeDiscountForCompletedOrder } from '@/lib/service-fee-discount';
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  normalizeRestaurantPeopleCount,
  normalizeRestaurantTakeawayCount,
  normalizeNoteSize,
  normalizePrintingServiceType,
  PRINTING_TASK_TYPE,
  RESTAURANT_MAX_PEOPLE,
  WATER_TASK_TYPE,
  DRY_CLEANING_TASK_TYPE,
} from '@/lib/pricing';
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications';
import { shouldSendOrderNotification } from '@/lib/test-orders';

const ALLOWED_CUSTOMER_TASK_TYPES = new Set(['restaurant', 'printing', 'shopping', 'water', 'copy_notes', DRY_CLEANING_TASK_TYPE]);
const COMPLETION_EXTENSION_MINUTES = 10;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Get the session
 const session = await auth.api.getSession({
  headers: request.headers,
});

    if (!session || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    ensureBookedAt(order);

    const previousStatus = order.status;

    const isUserOwner = order.userId === session.user.id;
    const isTaskerOwner = order.taskerId === session.user.taskerId;

    if (!isUserOwner && !isTaskerOwner) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      );
    }

    // Update only provided fields
    const {
      taskType,
      description,
      amount,
      deadlineDate,
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
      status,
      hasPaid,
      clearDeclinedTask,
      cafeInquiry,
      extendCompletionTimer,
      customerReceivedOrder,
    } = body;

    const resetDeclinedTask = () => {
      order.isDeclinedTask = false;
      order.declinedAt = undefined;
      order.declinedReason = undefined;
      order.declinedMessage = undefined;
      order.declinedByTaskerAt = undefined;
    };

    if (ensureCompletionTimer(order)) {
      await order.save();
      emitOrderUpdated(order);
    }

    if (clearDeclinedTask === true) {
      if (!isTaskerOwner || isUserOwner) {
        return NextResponse.json(
          { error: 'Only the assigned tasker can clear this declined task flag.' },
          { status: 403 }
        );
      }

      if (order.status !== 'in_progress') {
        return NextResponse.json(
          { error: 'Only in-progress tasks can be cleared from the tasker dashboard.' },
          { status: 400 }
        );
      }

      if (!order.isDeclinedTask) {
        return NextResponse.json(
          { error: 'This task is not currently declined.' },
          { status: 400 }
        );
      }

      resetDeclinedTask();
      await order.save();
      emitOrderUpdated(order);
      return NextResponse.json(order);
    }

    if (extendCompletionTimer === true) {
      if (!isUserOwner) {
        return NextResponse.json(
          { error: 'Only the customer can add more completion time.' },
          { status: 403 }
        );
      }

      if (!order.hasPaid || !order.completionDueAt || order.status === 'completed' || order.status === 'cancelled') {
        return NextResponse.json(
          { error: 'This task cannot be extended right now.' },
          { status: 400 }
        );
      }

      if (order.completionDueAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'Extra time can only be added before the timer runs out.' },
          { status: 400 }
        );
      }

      order.completionDueAt = new Date(order.completionDueAt.getTime() + COMPLETION_EXTENSION_MINUTES * 60000);
      order.completionExtensionMinutes =
        Number(order.completionExtensionMinutes || 0) + COMPLETION_EXTENSION_MINUTES;
      order.completionExtendedAt = new Date();

      await order.save();
      emitOrderUpdated(order);
      return NextResponse.json(order);
    }

    if (customerReceivedOrder !== undefined) {
      if (!isUserOwner) {
        return NextResponse.json(
          { error: 'Only the customer can answer this question.' },
          { status: 403 }
        );
      }

      if (order.status !== 'completed') {
        return NextResponse.json(
          { error: 'You can answer this after the tasker marks the task complete.' },
          { status: 400 }
        );
      }

      const receivedOrder = Boolean(customerReceivedOrder);
      order.customerReceiptConfirmed = receivedOrder;
      order.customerReceiptRespondedAt = new Date();

      if (!receivedOrder) {
        order.prematureCompletionReported = true;
        order.prematureCompletionReportedAt = order.customerReceiptRespondedAt;
        order.platformFeeWaivedForFastCompletion = false;
        order.completedBeforeTimer = false;
        order.taskerHasPaid = false;
        order.settlementStatus = 'pending';
        order.settlementDueAt =
          order.settlementDueAt || getSettlementDueAt(order.customerReceiptRespondedAt);
        order.settlementFailureReason =
          'Customer reported that the order had not been received when the tasker marked it complete.';
      }

      await order.save();
      emitOrderUpdated(order);
      return NextResponse.json(order);
    }

    if (
      taskType !== undefined ||
      description !== undefined ||
      amount !== undefined ||
      deadlineDate !== undefined ||
      location !== undefined ||
      store !== undefined ||
      packaging !== undefined ||
      restaurantPeopleCount !== undefined ||
      restaurantTakeawayCount !== undefined ||
      waterBags !== undefined ||
      noteSize !== undefined ||
      numberOfPages !== undefined ||
      deadline !== undefined ||
      copyNotesType !== undefined ||
      copyNotesPages !== undefined
      || printingServiceType !== undefined
      || printingNeedsEditing !== undefined ||
      cafeInquiry !== undefined
    ) {
      const isOnlyRestaurantPeopleUpdate =
        restaurantPeopleCount !== undefined &&
        taskType === undefined &&
        description === undefined &&
        amount === undefined &&
        deadlineDate === undefined &&
        location === undefined &&
        store === undefined &&
        packaging === undefined &&
        waterBags === undefined &&
        noteSize === undefined &&
        numberOfPages === undefined &&
        deadline === undefined &&
        copyNotesType === undefined &&
        copyNotesPages === undefined &&
        printingServiceType === undefined &&
        printingNeedsEditing === undefined;

      if (isOnlyRestaurantPeopleUpdate && isTaskerOwner && !isUserOwner) {
        const parsedRestaurantPeopleCount = Number(restaurantPeopleCount);

        if (order.taskType !== 'restaurant') {
          return NextResponse.json(
            { error: 'Only restaurant food orders can have people count updated.' },
            { status: 400 }
          );
        }

        if (order.hasPaid || order.paymentStatus === 'paid') {
          return NextResponse.json(
            { error: 'The customer has already confirmed payment for this order.' },
            { status: 400 }
          );
        }

        if (order.status !== 'pending' && order.status !== 'in_progress') {
          return NextResponse.json(
            { error: 'This order count can only be updated while the order is active.' },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(parsedRestaurantPeopleCount) ||
          parsedRestaurantPeopleCount < 1 ||
          parsedRestaurantPeopleCount > RESTAURANT_MAX_PEOPLE
        ) {
          return NextResponse.json(
            { error: `Restaurant food orders can only be for 1 to ${RESTAURANT_MAX_PEOPLE} people.` },
            { status: 400 }
          );
        }

        const pricing = calculateOrderPricing({
          amount: Number(order.itemPrice ?? order.amount ?? 0),
          taskType: order.taskType,
          store: order.store,
          restaurantPeopleCount: normalizeRestaurantPeopleCount(parsedRestaurantPeopleCount),
          restaurantTakeawayCount: normalizeRestaurantTakeawayCount(
            order.restaurantTakeawayCount,
            parsedRestaurantPeopleCount
          ),
        });
        const baseSettlement = splitServiceFee(pricing.serviceFee);
        const discountStillApplies = Boolean(order.serviceFeeDiscountApplied);
        const settlement = baseSettlement;

        order.amount = pricing.amount;
        order.commission = settlement.serviceFee;
        order.platformFee = settlement.platformFee;
        order.taskerFee = settlement.taskerFee;
        order.serviceFee = settlement.serviceFee;
        order.serviceFeeBeforeDiscount = discountStillApplies
          ? pricing.serviceFee
          : undefined;
        order.discountCommissionAmount = discountStillApplies
          ? baseSettlement.taskerFee || pricing.serviceFee
          : 0;
        order.pricingModel = pricing.pricingModel;
        order.totalAmount = discountStillApplies
          ? Math.max(0, pricing.totalAmount - pricing.serviceFee)
          : pricing.totalAmount;
        order.restaurantPeopleCount = pricing.restaurantPeopleCount;
        order.restaurantTakeawayCount = pricing.restaurantTakeawayCount;
        order.restaurantPackagingFee = pricing.restaurantPackagingFee || 0;

        await order.save();
        emitOrderUpdated(order);

        return NextResponse.json(order);
      }

      if (!isUserOwner) {
        return NextResponse.json(
          { error: 'Only the customer can edit this order' },
          { status: 403 }
        );
      }

      if (
        order.cafeInquiry &&
        order.cafeInquiryFeePaid &&
        !order.cafeInquiryDetailsSubmitted &&
        description !== undefined &&
        amount !== undefined
      ) {
        const nextDescription = String(description || '').trim();
        const nextAmount = Number(amount);

        if (nextDescription.length < 5) {
          return NextResponse.json(
            { error: 'Describe what you want after the cafe update.' },
            { status: 400 }
          );
        }

        if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
          return NextResponse.json(
            { error: 'Enter a valid food budget.' },
            { status: 400 }
          );
        }

        order.description = nextDescription;
        order.amount = nextAmount;
        order.itemPrice = nextAmount;
        order.totalAmount = nextAmount;
        order.cafeInquiryDetailsSubmitted = true;
        order.hasPaid = false;
        order.paidAt = undefined;
        order.completionTimerStartedAt = undefined;
        order.completionDueAt = undefined;
        order.completionWindowMinutes = undefined;
        order.completionExtensionMinutes = 0;
        order.completionExtendedAt = undefined;
        order.completedBeforeTimer = false;
        order.platformFeeWaivedForFastCompletion = false;
        order.customerReceiptConfirmed = undefined;
        order.customerReceiptRespondedAt = undefined;
        order.prematureCompletionReported = false;
        order.prematureCompletionReportedAt = undefined;
        order.paymentStatus = 'unpaid';
        order.paymentFailureReason = undefined;
        order.customerTransferredAt = undefined;
        await order.save();
        emitOrderUpdated(order);
        return NextResponse.json(order);
      }

      if (order.status !== 'pending' || order.taskerId) {
        return NextResponse.json(
          { error: 'This order can only be edited before a tasker accepts it' },
          { status: 400 }
        );
      }

      const nextTaskType = taskType !== undefined ? String(taskType) : order.taskType;
      const nextCafeInquiry = nextTaskType === 'restaurant' && cafeInquiry === true;
      const nextDescription =
        description !== undefined ? String(description).trim() : order.description;
      const nextAmount =
        amount !== undefined
          ? Number(amount)
          : nextTaskType === 'restaurant'
            ? Number(order.itemPrice ?? order.amount ?? 0)
            : order.amount;
      const nextStore = store !== undefined ? store || undefined : order.store;
      const nextPackaging =
        packaging !== undefined ? packaging || undefined : order.packaging;
      const parsedRestaurantPeopleCount =
        nextTaskType === 'restaurant'
          ? restaurantPeopleCount !== undefined
            ? Number(restaurantPeopleCount)
            : Number(order.restaurantPeopleCount || 1)
          : undefined;
      const nextRestaurantPeopleCount =
        nextTaskType === 'restaurant'
          ? normalizeRestaurantPeopleCount(parsedRestaurantPeopleCount)
          : undefined;
      const parsedRestaurantTakeawayCount =
        nextTaskType === 'restaurant'
          ? restaurantTakeawayCount !== undefined
            ? Number(restaurantTakeawayCount)
            : Number(order.restaurantTakeawayCount || 0)
          : undefined;
      const nextRestaurantTakeawayCount =
        nextTaskType === 'restaurant'
          ? normalizeRestaurantTakeawayCount(
              parsedRestaurantTakeawayCount,
              nextRestaurantPeopleCount
            )
          : undefined;
      const nextWaterBags =
        waterBags !== undefined
          ? Number(waterBags)
          : order.taskType === WATER_TASK_TYPE
            ? Number(order.waterBags || 0)
            : undefined;
      const nextNoteSize = normalizeNoteSize(
        noteSize !== undefined
          ? String(noteSize)
          : copyNotesType !== undefined
            ? String(copyNotesType)
            : order.noteSize || order.copyNotesType
      );
      const nextNumberOfPages =
        numberOfPages !== undefined
          ? Number(numberOfPages)
          : copyNotesPages !== undefined
            ? Number(copyNotesPages)
          : order.taskType === 'copy_notes' || order.taskType === PRINTING_TASK_TYPE
            ? Number(order.numberOfPages || order.copyNotesPages || 0)
            : undefined;
      const nextPrintingServiceType =
        nextTaskType === PRINTING_TASK_TYPE
          ? normalizePrintingServiceType(
              printingServiceType !== undefined
                ? String(printingServiceType)
                : order.printingServiceType
            )
          : undefined;
      const nextPrintingNeedsEditing =
        nextTaskType === PRINTING_TASK_TYPE
          ? printingNeedsEditing !== undefined
            ? Boolean(printingNeedsEditing)
            : Boolean(order.printingNeedsEditing)
          : false;
      const nextDeadlineDate =
        deadline !== undefined
          ? new Date(String(deadline).trim())
          : deadlineDate !== undefined
            ? new Date(String(deadlineDate).trim())
            : order.taskType === 'copy_notes' && (order.dueDate || order.deadline || order.deadlineDate)
            ? new Date(order.dueDate || order.deadline || order.deadlineDate)
            : undefined;

      if (
        nextTaskType !== 'copy_notes' &&
        nextTaskType !== PRINTING_TASK_TYPE &&
        nextTaskType !== WATER_TASK_TYPE &&
        (!Number.isFinite(nextAmount) || nextAmount < 0)
      ) {
        return NextResponse.json(
          { error: 'Enter a valid task amount' },
          { status: 400 }
        );
      }

      if (!ALLOWED_CUSTOMER_TASK_TYPES.has(nextTaskType)) {
        return NextResponse.json(
          { error: 'Select a valid task type.' },
          { status: 400 }
        );
      }

      if (nextDescription && descriptionMentionsWater(nextDescription) && nextTaskType !== WATER_TASK_TYPE) {
        return NextResponse.json(
          {
            error:
              'Choose the bag of water task for water delivery.',
          },
          { status: 400 }
        );
      }

      if (nextTaskType === WATER_TASK_TYPE) {
        if (!Number.isInteger(nextWaterBags) || Number(nextWaterBags) <= 0) {
          return NextResponse.json(
            { error: 'Enter the number of water bags for this delivery.' },
            { status: 400 }
          );
        }
      }

      if (
        nextTaskType === 'restaurant' &&
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
        nextTaskType === 'restaurant' &&
        (!Number.isInteger(parsedRestaurantTakeawayCount) ||
          Number(parsedRestaurantTakeawayCount) < 0 ||
          Number(parsedRestaurantTakeawayCount) > Number(nextRestaurantPeopleCount || 1))
      ) {
        return NextResponse.json(
          { error: 'Choose how many restaurant orders need takeaway packs.' },
          { status: 400 }
        );
      }

      if (nextTaskType === 'copy_notes') {
        if (!nextNoteSize) {
          return NextResponse.json({ error: 'Choose the note size.' }, { status: 400 });
        }

        if (!Number.isInteger(nextNumberOfPages) || Number(nextNumberOfPages) < 1) {
          return NextResponse.json({ error: 'Enter the number of pages.' }, { status: 400 });
        }

        if (
          !nextDeadlineDate ||
          Number.isNaN(nextDeadlineDate.getTime()) ||
          nextDeadlineDate.getTime() <= Date.now()
        ) {
          return NextResponse.json(
            { error: 'Choose a future deadline for the copied notes.' },
            { status: 400 }
          );
        }
      }

      if (nextTaskType === PRINTING_TASK_TYPE) {
        if (!nextPrintingServiceType) {
          return NextResponse.json(
            { error: 'Choose printing or photocopying.' },
            { status: 400 }
          );
        }

        if (!Number.isInteger(nextNumberOfPages) || Number(nextNumberOfPages) < 1) {
          return NextResponse.json(
            { error: 'Enter the number of pages.' },
            { status: 400 }
          );
        }
      }

      if (nextTaskType === 'shopping' || nextTaskType === DRY_CLEANING_TASK_TYPE) {
        if (nextDescription.length < 5) {
          return NextResponse.json(
            { error: nextTaskType === DRY_CLEANING_TASK_TYPE ? 'Describe the clothes you want cleaned.' : 'Describe the items you want.' },
            { status: 400 }
          );
        }

        if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
          return NextResponse.json(
            { error: nextTaskType === DRY_CLEANING_TASK_TYPE ? 'Enter a valid dry cleaning budget.' : 'Enter a valid shopping budget.' },
            { status: 400 }
          );
        }
      }

      const pricing = calculateOrderPricing({
        amount:
          nextTaskType === 'copy_notes' || nextTaskType === WATER_TASK_TYPE
            ? 0
            : nextAmount,
        taskType: nextTaskType,
        store: nextStore,
        restaurantPeopleCount: nextRestaurantPeopleCount,
        restaurantTakeawayCount: nextRestaurantTakeawayCount,
        waterBags: nextWaterBags,
        noteSize: nextNoteSize,
        numberOfPages: nextNumberOfPages,
        printingServiceType: nextPrintingServiceType,
        printingNeedsEditing: nextPrintingNeedsEditing,
        cafeInquiry: nextCafeInquiry,
      });
      const baseSettlement =
        pricing.pricingModel === 'copy_notes' || pricing.pricingModel === 'water'
          ? {
              serviceFee: pricing.serviceFee,
              platformFee: pricing.platformFee || 0,
              taskerFee: pricing.taskerFee || 0,
            }
          : splitServiceFee(pricing.serviceFee);
      const discountStillApplies = Boolean(order.serviceFeeDiscountApplied);
      const settlement = baseSettlement;

      order.taskType = nextTaskType;
      order.description = nextDescription;
      order.amount = pricing.amount;
      order.itemPrice =
        nextTaskType === 'restaurant' || nextTaskType === 'shopping' || nextTaskType === DRY_CLEANING_TASK_TYPE ? nextAmount : undefined;
      order.commission = settlement.serviceFee;
      order.platformFee = settlement.platformFee;
      order.taskerFee = settlement.taskerFee;
      order.serviceFee = settlement.serviceFee;
      order.serviceFeeBeforeDiscount = discountStillApplies
        ? pricing.serviceFee
        : undefined;
      order.discountCommissionAmount = discountStillApplies
        ? pricing.pricingModel === 'tiered'
          ? baseSettlement.taskerFee || pricing.serviceFee
          : pricing.serviceFee
        : 0;
      order.pricingModel = pricing.pricingModel;
      order.totalAmount = discountStillApplies
        ? Math.max(0, pricing.totalAmount - pricing.serviceFee)
        : pricing.totalAmount;
      order.cafeInquiry = nextCafeInquiry;
      order.cafeInquiryFeePaid = false;
      order.cafeInquiryDetailsSubmitted = !nextCafeInquiry;
      order.waterBags = pricing.waterBags || undefined;
      order.waterFee = pricing.waterFee;
      order.noteSize = pricing.noteSize;
      order.numberOfPages = pricing.numberOfPages;
      order.printingServiceType = pricing.printingServiceType;
      order.printingNeedsEditing = pricing.printingNeedsEditing;
      order.drawingPages = 0;
      order.copyNotesType = pricing.copyNotesType;
      order.copyNotesPages = pricing.copyNotesPages;
      order.hasPaid = false;
      order.paidAt = undefined;
      order.completionTimerStartedAt = undefined;
      order.completionDueAt = undefined;
      order.completionWindowMinutes = undefined;
      order.completionExtensionMinutes = 0;
      order.completionExtendedAt = undefined;
      order.completedBeforeTimer = false;
      order.platformFeeWaivedForFastCompletion = false;
      order.customerReceiptConfirmed = undefined;
      order.customerReceiptRespondedAt = undefined;
      order.prematureCompletionReported = false;
      order.prematureCompletionReportedAt = undefined;
      order.taskerHasPaid = false;
      resetDeclinedTask();
      order.paymentProvider = 'manual_transfer';
      order.paymentStatus = 'unpaid';
      order.paymentReference = undefined;
      order.paymentLink = undefined;
      order.paymentTransactionId = undefined;
      order.paymentInitializedAt = undefined;
      order.paymentVerifiedAt = undefined;
      order.paymentFailureReason = undefined;
      order.customerTransferredAt = undefined;
      order.settlementProvider = undefined;
      order.settlementStatus = 'not_due';
      order.settlementReference = undefined;
      order.settlementAccessCode = undefined;
      order.settlementCheckoutUrl = undefined;
      order.settlementTransactionId = undefined;
      order.settlementInitializedAt = undefined;
      order.settlementPaidAt = undefined;
      order.settlementDueAt = undefined;
      order.settlementFailureReason = undefined;

      order.deadline = nextTaskType === 'copy_notes' ? nextDeadlineDate : undefined;
      order.dueDate = nextTaskType === 'copy_notes' ? nextDeadlineDate : undefined;
      order.deadlineDate = nextTaskType === 'copy_notes' ? nextDeadlineDate : undefined;
      order.deadlineValue = undefined;
      order.deadlineUnit = undefined;
      if (location !== undefined) order.location = location;
      order.store =
        nextTaskType === 'copy_notes' ||
        nextTaskType === WATER_TASK_TYPE ||
        nextTaskType === DRY_CLEANING_TASK_TYPE
          ? undefined
          : nextStore;
      order.packaging =
        nextTaskType === 'restaurant'
          ? pricing.restaurantTakeawayCount && pricing.restaurantTakeawayCount > 0
            ? pricing.restaurantTakeawayCount === pricing.restaurantPeopleCount
              ? 'Takeaway pack'
              : `${pricing.restaurantTakeawayCount} takeaway, ${Number(pricing.restaurantPeopleCount || 0) - pricing.restaurantTakeawayCount} cellophane`
            : nextPackaging || 'Cellophane'
          : undefined;
      order.restaurantPeopleCount =
        nextTaskType === 'restaurant' ? pricing.restaurantPeopleCount : undefined;
      order.restaurantTakeawayCount =
        nextTaskType === 'restaurant' ? pricing.restaurantTakeawayCount : undefined;
      order.restaurantPackagingFee =
        nextTaskType === 'restaurant' ? pricing.restaurantPackagingFee || 0 : 0;
    }

    if (hasPaid !== undefined) {
      return NextResponse.json(
        {
          error:
            'Use the manual transfer confirmation action once you have sent the task amount.',
        },
        { status: 400 }
      );
    }

    let shouldSyncTaskerStats = false;

    if (status !== undefined) {
      if (status === 'cancelled' && isUserOwner) {
        if (!canCustomerCancelOrder(order)) {
          return NextResponse.json(
            {
              error:
                order.isDeclinedTask
                  ? 'This order is under payment review and can only be handled by admin.'
                  : 'You can only cancel an order before payment is confirmed.',
            },
            { status: 400 }
          );
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date();
        if (!order.hasPaid) {
          order.paymentStatus = 'cancelled';
        }
        order.settlementStatus = 'not_due';
        order.settlementReference = undefined;
        order.settlementAccessCode = undefined;
        order.settlementCheckoutUrl = undefined;
        order.settlementTransactionId = undefined;
        order.settlementInitializedAt = undefined;
        order.settlementPaidAt = undefined;
        order.settlementDueAt = undefined;
        order.settlementFailureReason = undefined;
      } else if (status === 'cancelled' && isTaskerOwner) {
        if (!canTaskerCancelOrder(order)) {
          return NextResponse.json(
            {
              error:
                order.isDeclinedTask
                  ? 'This order is under payment review and must be handled by admin.'
                  : 'You cannot cancel an order after customer payment is confirmed.',
            },
            { status: 400 }
          );
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date();
        if (!order.hasPaid) {
          order.paymentStatus = 'cancelled';
        }
        order.settlementStatus = 'not_due';
        order.settlementReference = undefined;
        order.settlementAccessCode = undefined;
        order.settlementCheckoutUrl = undefined;
        order.settlementTransactionId = undefined;
        order.settlementInitializedAt = undefined;
        order.settlementPaidAt = undefined;
        order.settlementDueAt = undefined;
        order.settlementFailureReason = undefined;
      } else if (status === 'completed') {
        if (!isTaskerOwner) {
          return NextResponse.json(
            { error: 'Only the assigned tasker can complete this order' },
            { status: 403 }
          );
        }

        if (order.isDeclinedTask) {
          return NextResponse.json(
            {
              error:
                'This order has a transfer issue under review and cannot be completed yet.',
            },
            { status: 400 }
          );
        }

        if (!order.hasPaid) {
          return NextResponse.json(
            { error: 'Customer payment must be confirmed before completion' },
            { status: 400 }
          );
        }

        order.status = 'completed';
        order.completedAt = new Date();
        const completedBeforeTimer =
          Boolean(order.completionDueAt) &&
          order.completedAt.getTime() <= order.completionDueAt.getTime();

        order.completedBeforeTimer = completedBeforeTimer;
        order.platformFeeWaivedForFastCompletion =
          completedBeforeTimer && Number(order.platformFee || 0) > 0;
        order.customerReceiptConfirmed = undefined;
        order.customerReceiptRespondedAt = undefined;
        order.prematureCompletionReported = false;
        order.prematureCompletionReportedAt = undefined;

        if (order.platformFeeWaivedForFastCompletion) {
          order.taskerHasPaid = true;
          order.settlementStatus = 'paid';
          order.settlementPaidAt = order.completedAt;
          order.settlementDueAt = undefined;
          order.settlementFailureReason = undefined;
        } else if (!order.taskerHasPaid) {
          order.settlementStatus = 'pending';
          order.settlementDueAt =
            order.settlementDueAt || getSettlementDueAt(order.completedAt);
          order.settlementFailureReason = undefined;
        }
      } else if (status === 'in_progress' || status === 'pending') {
        if (!isTaskerOwner) {
          return NextResponse.json(
            { error: 'Only the assigned tasker can change this order status' },
            { status: 403 }
          );
        }

        order.status = status;
      } else {
        return NextResponse.json(
          { error: 'Unsupported order status update' },
          { status: 400 }
        );
      }

      shouldSyncTaskerStats =
        Boolean(order.taskerId) &&
        previousStatus !== order.status &&
        (previousStatus === 'completed' || order.status === 'completed');
    }

    await order.save();

    if (shouldSyncTaskerStats && order.taskerId) {
      await syncTaskerStats(order.taskerId);
    }

    emitOrderUpdated(order);

    if (previousStatus !== 'completed' && order.status === 'completed') {
      if (!order.isTestOrder) {
        await consumeServiceFeeDiscountForCompletedOrder(order);
      }

      if (shouldSendOrderNotification(order)) {
        const pushResult = await sendPushNotification({
          audience: { userIds: [String(order.userId)] },
          title: 'Task completed',
          body: `Your ${formatPushTaskType(
            order.taskType
          ).toLowerCase()} task is complete. Add a quick review.`,
          url: `/dashboard/reviews/${order._id.toString()}`,
          tag: `order-completed-${order._id.toString()}`,
        });

        if (pushResult.skipped || pushResult.deliveredCount < pushResult.recipientCount) {
          console.warn('[Orders Complete Push Notification]:', pushResult);
        }
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Orders PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Get the session
const session = await auth.api.getSession({
  headers: request.headers,
});

    if (!session || !session.user) {
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

    if (!canCustomerCancelOrder(order)) {
      return NextResponse.json(
        { error: 'This order can no longer be deleted' },
        { status: 400 }
      );
    }

    const cancelledAt = new Date();

    ensureBookedAt(order);
    order.status = 'cancelled';
    order.cancelledAt = cancelledAt;
    if (!order.hasPaid) {
      order.paymentStatus = 'cancelled';
    }
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

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Orders DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Get the session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== session.user.id && order.taskerId !== session.user.taskerId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      );
    }

    if (ensureCompletionTimer(order)) {
      await order.save();
      emitOrderUpdated(order);
    }

    if (order.taskerId === session.user.taskerId && session.user.taskerId) {
      await syncTaskerSettlementStatus(session.user.taskerId)

      if (
        order.status === 'completed' &&
        !order.taskerHasPaid &&
        order.settlementDueAt &&
        order.settlementDueAt.getTime() <= Date.now() &&
        order.settlementStatus !== 'overdue'
      ) {
        order.settlementStatus = 'overdue'
        await order.save()
      }

      const refreshedOrder = await Order.findById(id)

      if (refreshedOrder) {
        return NextResponse.json(refreshedOrder)
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Orders GET by ID Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
