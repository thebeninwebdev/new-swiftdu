import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { IndomieBatch } from '@/models/indomie-batch'
import { Order } from '@/models/order'
import Tasker from '@/models/tasker'
import { User } from '@/models/user'
import { canTaskerDeliver } from '@/lib/delivery-policy'
import { getTaskerMode } from '@/lib/test-orders'
import { releaseDueIndomieBatches } from '@/lib/indomie-batch-release'

export async function GET(request: NextRequest) {
  await connectDB(); await releaseDueIndomieBatches()
  const session = await auth.api.getSession({ headers: request.headers })
  const tasker = session?.user?.id ? await Tasker.findOne({ userId: session.user.id }).lean() : null
  if (!tasker) return NextResponse.json([])
  const user = session?.user?.id ? await User.findById(session.user.id).select('gender').lean() : null
  const status = request.nextUrl.searchParams.get('accepted') === 'true' ? 'in_progress' : 'available'
  const batches = await IndomieBatch.find({ status, ...(status === 'in_progress' ? { taskerId: String(tasker._id) } : { isTestBatch: getTaskerMode(tasker) === 'training' }) }).sort({ availableAt: -1 }).lean()
  const visible = batches.filter(batch => canTaskerDeliver({ location: batch.destinationLabel, taskerGenderRestriction: batch.taskerGenderRestriction }, user?.gender))
  const ids = visible.flatMap(batch => batch.orderIds)
  const orders = await Order.find({ _id: { $in: ids } }).select('location roomNumber indomiePacks eggCount taskerFee status hasPaid isDeclinedTask customerName customerPhone').lean()
  return NextResponse.json(visible.map(batch => ({ ...batch, orders: orders.filter(order => batch.orderIds.includes(String(order._id))) })), { headers: { 'Cache-Control': 'no-store' } })
}
