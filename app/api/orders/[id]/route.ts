import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { syncTaskerStats } from '@/lib/tasker-stats';
import {Order} from "@/models/order"
import { auth } from '@/lib/auth'; 
import { canCustomerCancelOrder } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  WATER_TASK_TYPE,
} from '@/lib/pricing';

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
      deadlineValue,
      deadlineUnit,
      location,
      store,
      packaging,
      waterBags,
      status,
      hasPaid,
    } = body;

    if (
      taskType !== undefined ||
      description !== undefined ||
      amount !== undefined ||
      deadlineValue !== undefined ||
      deadlineUnit !== undefined ||
      location !== undefined ||
      store !== undefined ||
      packaging !== undefined
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

      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        return NextResponse.json(
          { error: 'Enter a valid task amount' },
          { status: 400 }
        );
      }

      if (descriptionMentionsWater(nextDescription) && nextTaskType !== WATER_TASK_TYPE) {
        return NextResponse.json(
          {
            error:
              'Water deliveries must use the Buy Water option so the per-bag fee can be calculated correctly.',
          },
          { status: 400 }
        );
      }

      if (nextTaskType === WATER_TASK_TYPE) {
        if (!nextStore) {
          return NextResponse.json(
            { error: 'Select the store for the water order.' },
            { status: 400 }
          );
        }

        if (!Number.isInteger(nextWaterBags) || Number(nextWaterBags) <= 0) {
          return NextResponse.json(
            { error: 'Enter the number of water bags for this delivery.' },
            { status: 400 }
          );
        }
      }

      const pricing = calculateOrderPricing({
        amount: nextAmount,
        taskType: nextTaskType,
        waterBags: nextWaterBags,
      });

      order.taskType = nextTaskType;
      order.description = nextDescription;
      order.amount = pricing.amount;
      order.commission = pricing.serviceFee;
      order.platformFee = pricing.serviceFee;
      order.taskerFee = 0;
      order.serviceFee = pricing.serviceFee;
      order.pricingModel = pricing.pricingModel;
      order.totalAmount = pricing.totalAmount;
      order.waterBags = pricing.waterBags || undefined;
      order.waterFee = pricing.waterFee;
      order.paymentStatus = 'unpaid';
      order.paymentReference = undefined;
      order.paymentLink = undefined;
      order.paymentTransactionId = undefined;
      order.paymentInitializedAt = undefined;
      order.paymentVerifiedAt = undefined;
      order.paymentFailureReason = undefined;

      if (deadlineValue !== undefined) order.deadlineValue = parseInt(deadlineValue);
      if (deadlineUnit !== undefined) order.deadlineUnit = deadlineUnit;
      if (location !== undefined) order.location = location;
      if (store !== undefined || nextTaskType !== WATER_TASK_TYPE) {
        order.store = nextStore;
      }
      order.packaging = nextTaskType === 'restaurant' ? nextPackaging : undefined;
    }

    if (hasPaid !== undefined) {
      return NextResponse.json(
        {
          error:
            'Customer payment is now confirmed automatically after Flutterwave verifies the transaction.',
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
                'You can only cancel an order before payment is confirmed.',
            },
            { status: 400 }
          );
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date();
        if (!order.hasPaid) {
          order.paymentStatus = 'cancelled';
        }
      } else if (status === 'cancelled' && isTaskerOwner) {
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        if (!order.hasPaid) {
          order.paymentStatus = 'cancelled';
        }
      } else if (status === 'completed') {
        if (!isTaskerOwner) {
          return NextResponse.json(
            { error: 'Only the assigned tasker can complete this order' },
            { status: 403 }
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

    await Order.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Order deleted successfully' });
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

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Orders GET by ID Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
