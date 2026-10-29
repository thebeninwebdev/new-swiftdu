import { connectDB } from '@/lib/db';
import {Order} from '@/models/order';
import Tasker from '@/models/tasker';
import { NextRequest, NextResponse } from 'next/server';
import { getTaskerOrderModeFilter } from '@/lib/test-orders';
import { applyCurrentSessionOrderScope, getActiveAcademicSession, NoActiveOrderSessionError, serializeOrderSession } from '@/lib/orders/order-session-scope';
import { parseOrderPagination } from '@/lib/orders/order-list-fields';

const NON_TEST_ORDER_MATCH = {
  $or: [{ isTestOrder: false }, { isTestOrder: { $exists: false } }],
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const taskerId = req.nextUrl.searchParams.get('taskerId');
    const status = req.nextUrl.searchParams.get('status');
    const { page, limit, skip } = parseOrderPagination(
      req.nextUrl.searchParams.get('page'),
      req.nextUrl.searchParams.get('limit') || '10'
    );

    if (!taskerId) {
      return NextResponse.json(
        { error: 'taskerId is required' },
        { status: 400 }
      );
    }

    const currentSession = await getActiveAcademicSession();
    const tasker = await Tasker.findById(taskerId).select('taskerMode isVerified').lean();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = applyCurrentSessionOrderScope(
      { taskerId, ...getTaskerOrderModeFilter(tasker || undefined) },
      currentSession
    );

    // Filter by status if provided
    if (status) {
      query = { $and: [query, { status }] };
    }

    const orders = await Order.find(query)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email profileImage')
      .sort({ acceptedAt: -1 })
      .lean();

    const total = await Order.countDocuments(query);

    // Calculate stats
    const completedQuery = applyCurrentSessionOrderScope({
      taskerId, status: 'completed', ...NON_TEST_ORDER_MATCH,
    }, currentSession);
    const completedOrders = await Order.countDocuments(completedQuery);

    const totalEarnings = await Order.aggregate([
      {
        $match: completedQuery,
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$taskerFee' },
        },
      },
    ]);

    return NextResponse.json({
      orders,
      stats: {
        completedOrders,
        totalEarnings: totalEarnings[0]?.total || 0,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      session: serializeOrderSession(currentSession),
    });
  } catch (error) {
    if (error instanceof NoActiveOrderSessionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Error fetching task history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task history' },
      { status: 500 }
    );
  }
}
