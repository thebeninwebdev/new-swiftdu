import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getOutstandingSettlementOrders, getOutstandingTrainingSettlementOrders } from '@/lib/tasker-settlement'
import { getTaskerMode } from '@/lib/test-orders'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })

  await connectDB()
  const user = await User.findById(session.user.id).select('role taskerId').lean()
  if (!user || user.role !== 'tasker') return NextResponse.json({ error: 'Tasker account not linked' }, { status: 403, headers: noStore })
  let tasker = await Tasker.findOne({ userId: user._id }).lean()
  if (!tasker && user.taskerId && Types.ObjectId.isValid(String(user.taskerId))) {
    tasker = await Tasker.findOne({
      _id: user.taskerId,
      $or: [{ userId: user._id }, { userId: null }],
    }).lean()
  }
  if (!tasker) return NextResponse.json({ error: 'Tasker account not found' }, { status: 404, headers: noStore })

  const taskerId = String(tasker._id)
  const liveOrders = await getOutstandingSettlementOrders(taskerId)
  const trainingOrders = getTaskerMode(tasker) === 'training' ? await getOutstandingTrainingSettlementOrders(taskerId) : []
  const orders = [...liveOrders, ...trainingOrders]

  return NextResponse.json({
    outstandingCount: liveOrders.length,
    orders: orders.map((order) => ({
      _id: order._id.toString(),
      platformFee: order.platformFee || 0,
      description: order.description || order.taskType,
      status: order.status,
      settlementStatus: order.settlementStatus,
      settlementDueAt: order.settlementDueAt,
      completedAt: order.completedAt,
      isTestOrder: order.isTestOrder === true,
    })),
  }, { headers: noStore })
}
