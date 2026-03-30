import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/order';
import { auth } from '@/lib/auth';

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
      deadlineValue,
      deadlineUnit,
      location,
      store,
      packaging,
    } = body;

    // Validation
    if (!taskType || !description || !amount || !deadlineValue || !deadlineUnit || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);

    const orderCommission = Math.round(parsedAmount * 0.15 * 100) / 100; // 15%
    const orderPlatformFee = Math.round(parsedAmount * 0.10 * 100) / 100; // 10%
    const orderTaskerFee = Math.round(parsedAmount * 0.05 * 100) / 100; // 5%
    const orderTotalAmount = Math.round((parsedAmount + orderCommission) * 100) / 100;

    const order = new Order({
      userId: session.user.id,
      taskType,
      description,
      amount: parsedAmount,
      commission: orderCommission,
      platformFee: orderPlatformFee,
      taskerFee: orderTaskerFee,
      totalAmount: orderTotalAmount,
      deadlineValue: parseInt(deadlineValue),
      deadlineUnit,
      location,
      store: store || undefined,
      packaging: packaging || undefined,
      status: 'pending',
    });

    await order.save();

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

    console.log(session.user)

    const orders = await Order.find({ userId: session.user.id }).sort({
      createdAt: -1,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('[Orders GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}