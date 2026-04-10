import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { syncTaskerStats } from '@/lib/tasker-stats';
import {Order} from "@/models/order"
import { auth } from '@/lib/auth'; 
import { canCustomerCancelOrder } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';

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

      if (taskType !== undefined) order.taskType = taskType;
      if (description !== undefined) order.description = description;
      if (amount !== undefined) order.amount = parseFloat(amount);
      if (deadlineValue !== undefined) order.deadlineValue = parseInt(deadlineValue);
      if (deadlineUnit !== undefined) order.deadlineUnit = deadlineUnit;
      if (location !== undefined) order.location = location;
      if (store !== undefined) order.store = store || undefined;
      if (packaging !== undefined) order.packaging = packaging || undefined;
    }

    if (hasPaid !== undefined) {
      if (!isUserOwner) {
        return NextResponse.json(
          { error: 'Only the customer can confirm payment' },
          { status: 403 }
        );
      }

      if (!order.taskerId) {
        return NextResponse.json(
          { error: 'A tasker must be assigned before payment can be confirmed' },
          { status: 400 }
        );
      }

      if (order.status === 'completed' || order.status === 'cancelled') {
        return NextResponse.json(
          { error: 'This order is no longer active' },
          { status: 400 }
        );
      }

      order.hasPaid = Boolean(hasPaid);
      order.paidAt = hasPaid ? new Date() : undefined;
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
      } else if (status === 'cancelled' && isTaskerOwner) {
        order.status = 'cancelled';
        order.cancelledAt = new Date();
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
      } else if (status === 'paid') {
        if (!isUserOwner) {
          return NextResponse.json(
            { error: 'Only the customer can mark this order as paid' },
            { status: 403 }
          );
        }

        order.status = 'paid';
        order.hasPaid = true;
        order.paidAt = new Date();
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

    emitOrderUpdated({
      _id: order._id.toString(),
      userId: order.userId,
      taskerId: order.taskerId,
      taskerName: order.taskerName,
      status: order.status,
      hasPaid: order.hasPaid,
    });
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
