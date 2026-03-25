import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/order';
import {auth} from  "@/lib/auth"
import { Types } from 'mongoose';

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

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Validate MongoDB ObjectId
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // Find the order
    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is still pending
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'This task is no longer available' },
        { status: 400 }
      );
    }

    // Check if user is trying to accept their own task
    if (order.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot accept your own task' },
        { status: 400 }
      );
    }

    // Check if task is already accepted by someone else
    if (order.taskerId) {
      return NextResponse.json(
        { error: 'This task has already been accepted' },
        { status: 400 }
      );
    }

    // Update the order with tasker info
    order.taskerId = session.user.id;
    order.taskerName = session.user.name || 'Anonymous';
    order.status = 'in_progress';
    await order.save();

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Accept Task PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to accept task' },
      { status: 500 }
    );
  }
}
