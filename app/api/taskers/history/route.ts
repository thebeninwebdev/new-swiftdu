import { connectDB } from '@/lib/db';
import {Order} from '@/models/order';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const taskerId = req.nextUrl.searchParams.get('taskerId');
    const status = req.nextUrl.searchParams.get('status');
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

    if (!taskerId) {
      return NextResponse.json(
        { error: 'taskerId is required' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { taskerId };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email profileImage')
      .sort({ acceptedAt: -1 });

    const total = await Order.countDocuments(query);

    // Calculate stats
    const completedOrders = await Order.countDocuments({
      taskerId,
      status: 'completed',
    });

    const totalEarnings = await Order.aggregate([
      {
        $match: {
          taskerId,
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
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
    });
  } catch (error) {
    console.error('Error fetching task history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task history' },
      { status: 500 }
    );
  }
}
