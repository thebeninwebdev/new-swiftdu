import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/order';
import { User } from '@/models/user';
import Tasker from '@/models/tasker';
import {
  calculateNetPlatformProfit,
  calculatePaystackSettlementFee,
  excludeCancelledOrders,
  excludeTestOrders,
  getEffectivePlatformFee,
} from '@/lib/order-finance';
import { getAdminDashboardAccess } from '@/lib/admin-access';
import { buildCreatedAtPeriodMatch, resolveFinancePeriod } from '@/lib/finance-periods';

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
    if (!await getAdminDashboardAccess(request.headers)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const period = await resolveFinancePeriod({ sessionId: searchParams.get('sessionId'), semesterId: searchParams.get('semesterId'), allTime: searchParams.get('period') === 'all-time' });
    const periodMatch = buildCreatedAtPeriodMatch(period);

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
    const nonTestQuery = excludeTestOrders({ ...query, ...periodMatch });

    const orders = await Order.find(nonTestQuery)
      .select('_id totalAmount commission taskerFee serviceFeeDiscountApplied discountCommissionAmount platformFee description taskType userId taskerId taskerName createdAt status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Batch-fetch user and tasker details to eliminate N+1 queries
    const userIds = [...new Set(orders.map((o: TransactionOrder) => o.userId).filter(Boolean))];
    const taskerIds = [...new Set(orders.map((o: TransactionOrder) => o.taskerId).filter(Boolean))];
    const [users, taskers] = await Promise.all([
      userIds.length ? User.find({ _id: { $in: userIds } }).select('_id name email').lean() : [],
      taskerIds.length ? Tasker.find({ _id: { $in: taskerIds } }).select('_id name email').lean() : [],
    ]);
    const userMap = new Map(users.map((u: { _id: unknown; name?: string; email?: string }) => [String(u._id), u]));
    const taskerMap = new Map(taskers.map((t: { _id: unknown; name?: string; email?: string }) => [String(t._id), t]));

    const transactions = orders.map((order: TransactionOrder) => {
      const user = userMap.get(String(order.userId));
      const tasker = order.taskerId ? taskerMap.get(String(order.taskerId)) : null;
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
    });

    // Calculate stats
    const [financeOrders, totalOrdersForQuery] = await Promise.all([
      Order.find(excludeCancelledOrders(periodMatch)).select('totalAmount taskerFee platformFee serviceFeeDiscountApplied discountCommissionAmount').lean(),
      Order.countDocuments(nonTestQuery),
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
      period,
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
