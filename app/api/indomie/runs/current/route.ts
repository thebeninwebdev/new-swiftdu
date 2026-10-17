import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'

/** Scheduled Indomie is deliberately separate from /api/orders?current=true. */
export async function GET(request: NextRequest) {
  await connectDB()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orders = await Order.find({ userId: session.user.id, taskType: 'indomie', indomieRunAt: { $gte: new Date(Date.now() - 2 * 60 * 60_000) }, status: { $nin: ['completed', 'cancelled'] } }).sort({ indomieRunAt: 1, createdAt: 1 }).lean()
  const groups = Object.values(orders.reduce<Record<string, typeof orders>>((result, order) => {
    const key = order.indomieReservationGroupId || String(order._id)
    ;(result[key] ||= []).push(order)
    return result
  }, {}))
  return NextResponse.json(groups)
}
