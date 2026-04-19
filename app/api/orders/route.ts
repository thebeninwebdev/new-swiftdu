import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { notifyTaskersOfNewTask } from '@/lib/tasker-notifications';
import { Order } from '@/models/order';
import { auth } from '@/lib/auth';
import { Review } from '@/models/review';
import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  WATER_TASK_TYPE,
} from '@/lib/pricing';

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
      waterBags,
    } = body;

    // Validation
    if (
      !taskType ||
      amount === undefined ||
      amount === null ||
      amount === '' ||
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
    const parsedWaterBags =
      normalizedTaskType === WATER_TASK_TYPE ? Number(waterBags) : undefined;

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'Enter a valid task amount' }, { status: 400 });
    }

    if (descriptionMentionsWater(normalizedDescription) && normalizedTaskType !== WATER_TASK_TYPE) {
      return NextResponse.json(
        {
          error:
            'Water deliveries must use the Buy Water option so the per-bag fee can be calculated correctly.',
        },
        { status: 400 }
      );
    }

    if (normalizedTaskType === WATER_TASK_TYPE) {
      if (!store) {
        return NextResponse.json(
          { error: 'Select the store for the water order.' },
          { status: 400 }
        );
      }

      if (!Number.isInteger(parsedWaterBags) || (parsedWaterBags ?? 0) <= 0) {
        return NextResponse.json(
          { error: 'Enter the number of water bags for this delivery.' },
          { status: 400 }
        );
      }
    }

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

    const pricing = calculateOrderPricing({
      amount: parsedAmount,
      taskType: normalizedTaskType,
      waterBags: parsedWaterBags,
    });

    const taskedFee = pricing.serviceFee - (pricing.serviceFee * .02);

    const order = new Order({
      userId: session.user.id,
      taskType: normalizedTaskType,
      description: normalizedDescription,
      amount: pricing.amount,
      commission: pricing.serviceFee,
      platformFee: (taskedFee * .25),
      taskerFee: (taskedFee * .75),
      serviceFee: taskedFee,
      pricingModel: pricing.pricingModel,
      totalAmount: pricing.totalAmount,
      location,
      store: store || undefined,
      packaging: packaging || undefined,
      waterBags: pricing.waterBags || undefined,
      waterFee: pricing.waterFee,
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    await order.save();

    try {
      await notifyTaskersOfNewTask({
        taskType,
        description,
        amount: parsedAmount,
        location,
        userName: session.user.name || 'A customer',
      });
    } catch (notificationError) {
      console.error('[Orders POST Tasker Notification Error]:', notificationError);
    }

    emitOrderUpdated(order);

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
