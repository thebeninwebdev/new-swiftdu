import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import Tasker from '@/models/tasker'
import { getCafeLabel, calculateCafeSelection, validateCafeOptions } from '@/lib/cafe-inquiry'
import { CAFE_INQUIRY_EXTRA_FEE } from '@/lib/pricing'
import { splitServiceFee } from '@/lib/order-finance'
import { emitOrderUpdated } from '@/lib/socket'
import { getTaskerMode, shouldSendOrderNotification } from '@/lib/test-orders'
import { sendPushNotification } from '@/lib/push-notifications'

export async function transitionCafeInquiry(request: NextRequest, id: string, action: 'checking' | 'options' | 'selection') {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  await connectDB()
  const order = await Order.findById(id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (action === 'selection') {
    if (order.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else {
    const tasker = await Tasker.findOne({ userId: session.user.id })
    if (!tasker || !tasker.isVerified || tasker.isRejected || String(tasker._id) !== order.taskerId || (getTaskerMode(tasker) === 'training') !== Boolean(order.isTestOrder)) {
      return NextResponse.json({ error: 'Only the assigned Tasker can update cafe availability.' }, { status: 403 })
    }
  }
  if (!order.cafeInquiry || !order.cafeInquiryStatus || order.taskType !== 'restaurant' || order.status !== 'in_progress' || order.hasPaid || order.isDeclinedTask) {
    return NextResponse.json({ error: 'This cafe request cannot be updated now.' }, { status: 409 })
  }
  const allowed = action === 'selection' ? ['awaiting_customer_choice'] : action === 'checking' ? ['tasker_assigned', 'unavailable'] : ['checking_cafe', 'awaiting_customer_choice', 'unavailable']
  if (!allowed.includes(order.cafeInquiryStatus)) return NextResponse.json({ error: 'This action is not available at this stage.' }, { status: 409 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const update: Record<string, unknown> = {}
  try {
    if (action === 'checking') update.cafeInquiryStatus = 'checking_cafe'
    if (action === 'options') {
      if (body.version !== (order.cafeOptionsVersion || 0)) return NextResponse.json({ error: 'Availability changed. Review the latest options.' }, { status: 409 })
      const items = body.unavailable === true ? [] : validateCafeOptions(body.items).map(item => ({ ...item, id: randomUUID() }))
      update.cafeAvailableItems = items
      update.cafeInquiryStatus = items.length ? 'awaiting_customer_choice' : 'unavailable'
      update.cafeOptionsSentAt = new Date()
    }
    if (action === 'selection') {
      if (body.version !== order.cafeOptionsVersion) return NextResponse.json({ error: 'The Tasker corrected the options. Review the latest list before choosing.' }, { status: 409 })
      const result = calculateCafeSelection(order.cafeAvailableItems || [], body.items, body.restaurantPeopleCount, body.restaurantTakeawayCount, Boolean(order.serviceFeeDiscountApplied))
      const settlement = splitServiceFee(result.pricing.serviceFee)
      Object.assign(update, {
        cafeSelectedItems: result.selected, cafeSelectionSubmittedAt: new Date(), cafeInquiryStatus: 'ready_for_payment', cafeInquiryDetailsSubmitted: true,
        description: result.selected.map(item => `${item.quantity}${item.unit ? ` ${item.unit}` : ''} × ${item.name}`).join(', '),
        amount: result.pricing.amount, itemPrice: result.pricing.amount, totalAmount: result.totalAmount,
        serviceFee: settlement.serviceFee, commission: settlement.serviceFee, platformFee: settlement.platformFee, taskerFee: settlement.taskerFee,
        serviceFeeBeforeDiscount: order.serviceFeeDiscountApplied ? settlement.serviceFee : undefined,
        discountCommissionAmount: order.serviceFeeDiscountApplied ? splitServiceFee(settlement.serviceFee - CAFE_INQUIRY_EXTRA_FEE).taskerFee : 0,
        restaurantPeopleCount: result.pricing.restaurantPeopleCount, restaurantTakeawayCount: result.pricing.restaurantTakeawayCount,
        restaurantPackagingFee: result.pricing.restaurantPackagingFee, packaging: result.packaging,
      })
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid cafe request' }, { status: 400 })
  }
  // Compare-and-set makes corrections, choices and cancellation mutually exclusive.
  const updated = await Order.findOneAndUpdate({
    _id: id, userId: order.userId, taskerId: order.taskerId, status: 'in_progress', hasPaid: false,
    isDeclinedTask: { $ne: true }, cafeInquiryStatus: order.cafeInquiryStatus, cafeOptionsVersion: order.cafeOptionsVersion || 0,
  }, { $set: update, $inc: { cafeOptionsVersion: 1 } }, { new: true, runValidators: true })
  if (!updated) return NextResponse.json({ error: 'This request changed. Review its latest state.' }, { status: 409 })
  emitOrderUpdated(updated)
  if (action === 'options' && shouldSendOrderNotification(updated)) {
    try {
      await sendPushNotification({ audience: { userIds: [String(updated.userId)] }, title: 'Cafe update',
        body: updated.cafeInquiryStatus === 'unavailable' ? 'Nothing suitable is available right now. Open your request for details.' : `Your Tasker has sent what’s available at ${getCafeLabel(updated.store)}. Choose your food to continue.`,
        url: `/dashboard/tasks/${id}`, tag: `cafe-options-${id}` })
    } catch (error) { console.error('[Cafe availability notification]', error) }
  }
  return NextResponse.json({ order: updated })
}
