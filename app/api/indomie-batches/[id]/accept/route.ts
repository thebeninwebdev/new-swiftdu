import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { IndomieBatch } from '@/models/indomie-batch'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import { canTaskerDeliver } from '@/lib/delivery-policy'
import { currentTasker, lockTaskerWork, WorkError } from '@/lib/tasker-work-server'
import { TaskerWorkSession } from '@/models/tasker-work-session'
import { getTaskerMode } from '@/lib/test-orders'
import { canWorkOnOrder, OPERATIONS_SUSPENDED } from '@/lib/operations'
import { emitOrderUpdated } from '@/lib/socket'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const session = await auth.api.getSession({ headers: request.headers }); if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tasker = await currentTasker(request.headers); const { id } = await context.params; const batch = await IndomieBatch.findById(id)
    if (!batch || batch.status !== 'available') return NextResponse.json({ error: 'This batch has already been accepted.' }, { status: 409 })
    const account = await User.findById(session.user.id).select('gender').lean()
    if (!canTaskerDeliver({ location: batch.destinationLabel, taskerGenderRestriction: batch.taskerGenderRestriction }, account?.gender)) return NextResponse.json({ error: 'You are not eligible to deliver to this destination.' }, { status: 403 })
    if (!canWorkOnOrder(batch.isTestBatch)) return NextResponse.json(OPERATIONS_SUSPENDED, { status: 503 })
    if ((getTaskerMode(tasker) === 'training') !== batch.isTestBatch) return NextResponse.json({ error: 'This batch is not available in your current tasker mode.' }, { status: 403 })
    const release = await lockTaskerWork(String(tasker._id)); const now = new Date()
    try {
      if (!await TaskerWorkSession.exists({ taskerId: String(tasker._id), open: true })) throw new WorkError('Check in before accepting a new task.', 403)
      const won = await IndomieBatch.findOneAndUpdate({ _id: id, status: 'available' }, { $set: { status: 'in_progress', taskerId: String(tasker._id), taskerName: session.user.name || 'Anonymous', acceptedBy: session.user.id, acceptedAt: now } }, { new: true })
      if (!won) return NextResponse.json({ error: 'This batch has already been accepted.' }, { status: 409 })
      const result = await Order.updateMany({ _id: { $in: won.orderIds }, batchId: String(won._id), status: 'pending', taskerId: { $in: [null, ''] } }, { $set: { status: 'in_progress', taskerId: String(tasker._id), taskerName: session.user.name || 'Anonymous', acceptedBy: session.user.id, acceptedAt: now, bookedAt: now, paymentProvider: 'manual_transfer' } })
      if (result.modifiedCount !== won.orderCount) { await IndomieBatch.updateOne({ _id: won._id, taskerId: String(tasker._id) }, { $set: { status: 'available' }, $unset: { taskerId: 1, taskerName: 1, acceptedBy: 1, acceptedAt: 1 } }); return NextResponse.json({ error: 'This batch is no longer available.' }, { status: 409 }) }
      const orders = await Order.find({ _id: { $in: won.orderIds } }); orders.forEach(emitOrderUpdated)
      return NextResponse.json(won)
    } finally { await release() }
  } catch (error) { if (error instanceof WorkError) return NextResponse.json({ error: error.message }, { status: error.status }); console.error(error); return NextResponse.json({ error: 'Failed to accept batch.' }, { status: 500 }) }
}
