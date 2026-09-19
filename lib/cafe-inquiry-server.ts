import { Types } from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import Tasker from '@/models/tasker'
import { getCafeLabel } from '@/lib/cafe-inquiry'
import { emitOrderUpdated } from '@/lib/socket'
import { getTaskerMode, shouldSendOrderNotification } from '@/lib/test-orders'
import { sendPushNotification } from '@/lib/push-notifications'

export async function transitionCafeInquiry(request: NextRequest, id: string, action: 'checking' | 'options' | 'selection') {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  if (action !== 'checking') return NextResponse.json({ error: 'Cafe details are now discussed on WhatsApp.' }, { status: 410 })

  await connectDB()
  const order = await Order.findById(id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const tasker = await Tasker.findOne({ userId: session.user.id })
  if (!tasker || !tasker.isVerified || tasker.isRejected || String(tasker._id) !== order.taskerId || (getTaskerMode(tasker) === 'training') !== Boolean(order.isTestOrder)) {
    return NextResponse.json({ error: 'Only the assigned Tasker can update this cafe inquiry.' }, { status: 403 })
  }
  if (!order.cafeInquiry || order.taskType !== 'restaurant' || order.status !== 'in_progress' || order.cafeInquiryStatus !== 'tasker_assigned' || order.hasPaid || order.isDeclinedTask) {
    return NextResponse.json({ error: 'This cafe request cannot be updated now.' }, { status: 409 })
  }
  const updated = await Order.findOneAndUpdate({
    _id: id, taskerId: order.taskerId, status: 'in_progress', cafeInquiryStatus: 'tasker_assigned',
    hasPaid: false, isDeclinedTask: { $ne: true },
  }, { $set: { cafeInquiryStatus: 'checking_cafe' } }, { new: true, runValidators: true })
  if (!updated) return NextResponse.json({ error: 'This request changed. Review its latest state.' }, { status: 409 })

  emitOrderUpdated(updated)
  if (shouldSendOrderNotification(updated)) {
    try {
      await sendPushNotification({
        audience: { userIds: [String(updated.userId)] }, title: 'Tasker at cafe',
        body: `Your Tasker is at ${getCafeLabel(updated.store)}. Continue the inquiry on WhatsApp.`,
        url: `/dashboard/tasks/${id}`, tag: `cafe-arrival-${id}`,
      })
    } catch (error) { console.error('[Cafe arrival notification]', error) }
  }
  return NextResponse.json({ order: updated })
}