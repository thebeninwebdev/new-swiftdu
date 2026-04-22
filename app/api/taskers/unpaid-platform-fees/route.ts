import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getOutstandingSettlementOrders } from '@/lib/tasker-settlement'

export async function GET(req: Request) {
  await connectDB()

  const session = await auth.api.getSession({
    headers: req.headers,
  })

  if (!session?.user?.taskerId) {
    return NextResponse.json({ orders: [] })
  }

  const orders = await getOutstandingSettlementOrders(String(session.user.taskerId))

  return NextResponse.json({
    orders: orders.map((order) => ({
      _id: order._id.toString(),
      platformFee: order.platformFee || 0,
      description: order.description || order.taskType,
      status: order.status,
      settlementStatus: order.settlementStatus,
      settlementDueAt: order.settlementDueAt,
      completedAt: order.completedAt,
    })),
  })
}
