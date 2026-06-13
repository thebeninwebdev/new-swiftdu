import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/order';
import { User } from '@/models/user';
import Tasker from '@/models/tasker';
import {
  calculateNetPlatformProfit,
  calculatePaystackSettlementFee,
  excludeCancelledOrders,
  getEffectivePlatformFee,
} from '@/lib/order-finance';

type TransactionOrder = {
  _id: unknown;
  userId?: string;
  taskerId?: string;
  taskerName?: string;
  totalAmount?: number;
  commission?: number;
  platformFee?: number;
  platformFeeWaivedForFastCompletion?: boolean;
  taskerFee?: number;
  description?: string;
  taskType?: string;
  createdAt?: Date;
  status?: string;
};

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin role check
    // const session = await auth();
    // if (!session || session.user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { taskType: { $regex: search, $options: 'i' } },
      ];
    }

    // Get orders for transactions
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch user and tasker details and enrich orders
    const transactions = await Promise.all(
      orders.map(async (order: TransactionOrder) => {
        const user = await User.findById(order.userId).select('name email').lean();
        const tasker = order.taskerId ? await Tasker.findById(order.taskerId).select('name email').lean() : null;
        const effectivePlatformFee = getEffectivePlatformFee(order);

        return {
          _id: order._id,
          type: 'order_payment' as const,
          amount: order.totalAmount,
          commission: order.commission,
          platformFee: effectivePlatformFee,
          paystackSettlementFee: calculatePaystackSettlementFee(effectivePlatformFee),
          netPlatformProfit: calculateNetPlatformProfit(effectivePlatformFee),
          taskerFee: order.taskerFee,
          description: order.description,
          taskType: order.taskType,
          userId: order.userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
          taskerId: order.taskerId,
          taskerName: tasker?.name || order.taskerName || 'Unassigned',
          taskerEmail: tasker?.email || '',
          orderId: order._id,
          timestamp: order.createdAt,
          status: order.status,
        };
      })
    );

    // Calculate stats
    const [financeOrders, totalOrdersForQuery] = await Promise.all([
      Order.find(excludeCancelledOrders()).lean(),
      Order.countDocuments(query),
    ]);
    const totalVolume = financeOrders.reduce((sum, order: TransactionOrder) => sum + (order.totalAmount || 0), 0);
    const totalTransactions = financeOrders.length;
    const totalPlatformFees = financeOrders.reduce((sum, order: TransactionOrder) => sum + getEffectivePlatformFee(order), 0);
    const totalPaystackSettlementFees = Math.round(financeOrders.reduce(
      (sum, order: TransactionOrder) => sum + calculatePaystackSettlementFee(getEffectivePlatformFee(order)),
      0
    ) * 100) / 100;
    const totalTaskerFees = financeOrders.reduce((sum, order: TransactionOrder) => sum + (order.taskerFee || 0), 0);
    const netRevenue = Math.round((totalPlatformFees - totalPaystackSettlementFees) * 100) / 100;

    const totalPages = Math.ceil(totalOrdersForQuery / limit);

    return NextResponse.json({
      transactions,
      stats: {
        totalVolume,
        totalTransactions,
        totalPlatformFees,
        totalPaystackSettlementFees,
        totalTaskerFees,
        netRevenue,
      },
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching admin transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
