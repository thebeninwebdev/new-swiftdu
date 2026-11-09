import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import { shouldCreateTestOrder } from '@/lib/test-orders'
import { applyCurrentSessionOrderScope, getActiveAcademicSession, NoActiveOrderSessionError } from '@/lib/orders/order-session-scope'

const INDOMIE_RUN_ORDER_FIELDS = [
  '_id', 'taskType', 'description', 'status', 'location', 'roomNumber',
  'indomiePacks', 'eggCount', 'indomieSlotCount', 'indomieRunAt', 'indomieRunStatus',
  'scheduledFor', 'indomieReservationGroupId', 'totalAmount', 'taskerFee', 'hasPaid',
  'isDeclinedTask', 'taskerId', 'taskerName', 'isTestOrder', 'createdAt',
].join(' ')

/** Scheduled Indomie is deliberately separate from /api/orders?current=true. */
export async function GET(request: NextRequest) {
  try {
    await connectDB()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await User.findById(session.user.id).select('isExco excoRole testOrderMode').lean()
    const isTestOrder = shouldCreateTestOrder(account || undefined)
    const currentSession = await getActiveAcademicSession()

    const scopedQuery = applyCurrentSessionOrderScope({
      userId: session.user.id,
      isTestOrder: isTestOrder ? true : { $ne: true },
      taskType: 'indomie',
      indomieRunAt: { $exists: true },
      status: { $nin: ['completed', 'cancelled'] },
    }, currentSession)

    const orders = await Order.find(scopedQuery)
      .select(INDOMIE_RUN_ORDER_FIELDS)
      .sort({ indomieRunAt: 1, createdAt: 1 })
      .lean()

    const groups = Object.values(orders.reduce<Record<string, typeof orders>>((result, order) => {
      const key = order.indomieReservationGroupId || String(order._id)
      ;(result[key] ||= []).push(order)
      return result
    }, {}))
    return NextResponse.json(groups)
  } catch (error) {
    if (error instanceof NoActiveOrderSessionError) {
      return NextResponse.json([])
    }
    console.error('[Indomie Runs Current Error]:', error)
    return NextResponse.json({ error: 'Failed to fetch current Indomie runs' }, { status: 500 })
  }
}
