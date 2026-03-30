import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import {Order} from "@/models/order"
import { auth } from '@/lib/auth'; 

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

    // Verify ownership
    if (order.userId !== session.user.id && order.taskerId !== session.user.taskerId) {
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

    if (taskType !== undefined) order.taskType = taskType;
    if (hasPaid !== undefined) order.hasPaid = hasPaid;
    if (description !== undefined) order.description = description;
    if (amount !== undefined) order.amount = parseFloat(amount);
    if (deadlineValue !== undefined) order.deadlineValue = parseInt(deadlineValue);
    if (deadlineUnit !== undefined) order.deadlineUnit = deadlineUnit;
    if (location !== undefined) order.location = location;
    if (store !== undefined) order.store = store || undefined;
    if (packaging !== undefined) order.packaging = packaging || undefined;
    if (status !== undefined) {
      order.status = status;
      if (status === 'paid') {
        order.hasPaid = true;
      }
      // If order is completed, increment tasker's completedTasks and update rating
      if (status === 'completed' && order.taskerId) {
        const Tasker = (await import('@/models/tasker')).default;
        const Review = (await import('@/models/review')).Review;
        // Increment completedTasks
        await Tasker.findByIdAndUpdate(order.taskerId, { $inc: { completedTasks: 1 } });
        // Recalculate rating
        const reviews = await Review.find({ taskerId: order.taskerId });
        if (reviews.length > 0) {
          const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          await Tasker.findByIdAndUpdate(order.taskerId, { rating: avgRating });
        }
      }
    }

    await order.save();
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

    // Verify ownership
    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
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

    // Verify ownership
    if (order.taskerId !== session.user.taskerId) {
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
