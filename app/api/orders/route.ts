import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { notifyTaskersOfNewTask } from '@/lib/tasker-notifications';
import { Order } from '@/models/order';
import { auth } from '@/lib/auth';
import { Review } from '@/models/review';
import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';

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
    const parsedDeadlineValue = parseInt(deadlineValue, 10);

    const existingActiveOrder = await Order.findOne({
      userId: session.user.id,
      status: { $in: [...ACTIVE_ORDER_STATUSES] },
    }).sort({ createdAt: -1 });

    if (existingActiveOrder) {
      return NextResponse.json(
        {
          error:
            'You already have an active order. Complete or cancel it before booking another one.',
          existingOrderId: existingActiveOrder._id,
        },
        { status: 409 }
      );
    }

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
      deadlineValue: parsedDeadlineValue,
      deadlineUnit,
      location,
      store: store || undefined,
      packaging: packaging || undefined,
      status: 'pending',
    });

    await order.save();

    try {
      await notifyTaskersOfNewTask({
        taskType,
        description,
        amount: parsedAmount,
        location,
        deadlineValue: parsedDeadlineValue,
        deadlineUnit,
        userName: session.user.name || 'A customer',
      });
    } catch (notificationError) {
      console.error('[Orders POST Tasker Notification Error]:', notificationError);
    }

    emitOrderUpdated({
      _id: order._id.toString(),
      userId: order.userId,
      taskerId: order.taskerId,
      taskerName: order.taskerName,
      status: order.status,
      hasPaid: order.hasPaid,
    });

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
