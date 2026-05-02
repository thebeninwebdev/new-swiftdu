import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { syncTaskerStats } from '@/lib/tasker-stats';
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement';
import {Order} from "@/models/order"
import { auth } from '@/lib/auth'; 
import { canCustomerCancelOrder, canTaskerCancelOrder } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';
import { getSettlementDueAt, splitServiceFee } from '@/lib/order-finance';
import { ensureBookedAt } from '@/lib/order-response-time';
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  WATER_TASK_TYPE,
} from '@/lib/pricing';
import { requiresPremiumTasker } from '@/lib/tasker-access';

const ALLOWED_CUSTOMER_TASK_TYPES = new Set(['restaurant', 'printing', 'shopping', 'water', 'copy_notes']);

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
      waterBags,
      copyNotesType,
      copyNotesPages,
      status,
      hasPaid,
    } = body;

    if (
      taskType !== undefined ||
      description !== undefined ||
      amount !== undefined ||
      deadlineDate !== undefined ||
      location !== undefined ||
      store !== undefined ||
      packaging !== undefined ||
      waterBags !== undefined ||
      copyNotesType !== undefined ||
      copyNotesPages !== undefined
    ) {
      if (!isUserOwner) {
        return NextResponse.json(
          { error: 'Only the customer can edit this order' },
          { status: 403 }
        );
      }

      if (order.status !== 'pending' || order.taskerId) {
        return NextResponse.json(
          { error: 'This order can only be edited before a tasker accepts it' },
          { status: 400 }
        );
      }

      const nextTaskType = taskType !== undefined ? String(taskType) : order.taskType;
      const nextDescription =
        description !== undefined ? String(description).trim() : order.description;
      const nextAmount = amount !== undefined ? Number(amount) : order.amount;
      const nextStore = store !== undefined ? store || undefined : order.store;
      const nextPackaging =
        packaging !== undefined ? packaging || undefined : order.packaging;
      const nextWaterBags =
        waterBags !== undefined
          ? Number(waterBags)
          : order.taskType === WATER_TASK_TYPE
            ? Number(order.waterBags || 0)
            : undefined;
      const nextCopyNotesType =
        copyNotesType !== undefined ? String(copyNotesType) : order.copyNotesType;
      const nextCopyNotesPages =
        copyNotesPages !== undefined
          ? Number(copyNotesPages)
          : order.taskType === 'copy_notes'
            ? Number(order.copyNotesPages || 0)
            : undefined;
      const nextDeadlineDate =
        deadlineDate !== undefined
          ? new Date(`${String(deadlineDate).trim()}T00:00:00`)
          : order.taskType === 'copy_notes' && order.deadlineDate
            ? new Date(order.deadlineDate)
            : undefined;

      if (
        nextTaskType !== 'copy_notes' &&
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

      if (descriptionMentionsWater(nextDescription) && nextTaskType !== WATER_TASK_TYPE) {
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

      if (nextTaskType === 'copy_notes') {
        if (nextCopyNotesType !== 'hardback' && nextCopyNotesType !== 'small') {
          return NextResponse.json({ error: 'Choose the note type.' }, { status: 400 });
        }

        if (!Number.isInteger(nextCopyNotesPages) || Number(nextCopyNotesPages) <= 0) {
          return NextResponse.json({ error: 'Enter the number of pages.' }, { status: 400 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (
          !nextDeadlineDate ||
          Number.isNaN(nextDeadlineDate.getTime()) ||
          nextDeadlineDate < today
        ) {
          return NextResponse.json(
            { error: 'Choose the date the copied notes should be ready.' },
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
        waterBags: nextWaterBags,
        copyNotesType: nextCopyNotesType,
        copyNotesPages: nextCopyNotesPages,
      });
      const settlement =
        pricing.pricingModel === 'copy_notes' || pricing.pricingModel === 'water'
          ? {
              serviceFee: pricing.serviceFee,
              platformFee: pricing.platformFee || 0,
              taskerFee: pricing.taskerFee || 0,
            }
          : splitServiceFee(pricing.serviceFee);

      order.taskType = nextTaskType;
      order.description = nextDescription;
      order.amount = pricing.amount;
      order.commission = settlement.serviceFee;
      order.platformFee = settlement.platformFee;
      order.taskerFee = settlement.taskerFee;
      order.serviceFee = settlement.serviceFee;
      order.pricingModel = pricing.pricingModel;
      order.totalAmount = pricing.totalAmount;
      order.requiresPremiumTasker = requiresPremiumTasker(pricing.amount);
      order.waterBags = pricing.waterBags || undefined;
      order.waterFee = pricing.waterFee;
      order.copyNotesType = pricing.copyNotesType;
      order.copyNotesPages = pricing.copyNotesPages;
      order.hasPaid = false;
      order.paidAt = undefined;
      order.taskerHasPaid = false;
      order.isDeclinedTask = false;
      order.declinedAt = undefined;
      order.declinedReason = undefined;
      order.declinedMessage = undefined;
      order.declinedByTaskerAt = undefined;
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

      order.deadlineDate = nextTaskType === 'copy_notes' ? nextDeadlineDate : undefined;
      order.deadlineValue = undefined;
      order.deadlineUnit = undefined;
      if (location !== undefined) order.location = location;
      order.store =
        nextTaskType === 'copy_notes' || nextTaskType === WATER_TASK_TYPE
          ? undefined
          : nextStore;
      order.packaging = nextTaskType === 'restaurant' ? nextPackaging : undefined;
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
        if (!order.taskerHasPaid) {
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
