import mongoose, { type ClientSession } from 'mongoose'
import { Order, type IOrder } from '@/models/order'
import { User } from '@/models/user'
import { AcademicSession } from '@/models/academic-session'
import { FirstOrderBonusClaim } from '@/models/first-order-bonus-claim'
import { canReleaseFirstOrderReservation, priceWithOrderDiscounts } from './first-order-pricing'
import type { PricingResult } from './pricing'

export class OrderChangedError extends Error { constructor() { super('Order changed. Refresh and try again.') } }
export class NoActiveAcademicSessionError extends Error { constructor() { super('No active SwiftDU session is configured. Please contact an administrator.') } }

async function activeSession(session?: ClientSession) {
  const current = await AcademicSession.findOne({ isActive: true }).session(session || null).lean()
  if (!current) throw new NoActiveAcademicSessionError()
  return current
}

async function canonicalUserId(userId: string, session?: ClientSession) {
  const user = await User.findById(userId).session(session || null)
  return user ? String(user._id) : userId
}

export async function firstOrderBonusEligibility(userId: string) {
  const current = await activeSession()
  const customerId = await canonicalUserId(userId)
  const claim = await FirstOrderBonusClaim.exists({ userId: customerId, sessionId: current._id })
  return { eligible: !claim, sessionId: String(current._id), sessionName: current.name }
}

export async function firstOrderBonusAvailable(userId: string) {
  return (await firstOrderBonusEligibility(userId)).eligible
}

async function lockCustomer(userId: string, session: ClientSession) {
  // Preserve the existing serialization mechanism as a second line of defence
  // around the unique session claim.
  const user = await User.findByIdAndUpdate(userId, { $inc: { firstOrderBonusVersion: 1 } }, { new: true, session })
  return user ? String(user._id) : userId
}

export async function saveNewOrderWithBonus(order: IOrder, pricing: PricingResult) {
  if (order.isTestOrder) {
    Object.assign(order, priceWithOrderDiscounts(pricing, { serviceFeeDiscount: order.serviceFeeDiscountApplied, cafeInquiry: order.cafeInquiry }))
    await order.save(); return
  }
  await mongoose.connection.transaction(async session => {
    const current = await activeSession(session)
    const customerId = await lockCustomer(order.userId, session)
    order.sessionId = current._id
    order.sessionName = current.name
    let eligible = false
    try {
      await FirstOrderBonusClaim.create([{ userId: customerId, sessionId: current._id, orderId: String(order._id), claimedAt: new Date() }], { session })
      eligible = true
    } catch (error) {
      // A duplicate key is the expected concurrent/not-first path. Other errors
      // still abort the transaction instead of silently pricing an order wrongly.
      if ((error as { code?: number }).code !== 11000) throw error
    }
    if (eligible) order.firstOrderBonusSessionId = current._id
    Object.assign(order, priceWithOrderDiscounts(pricing, { firstOrderBonus: eligible, serviceFeeDiscount: order.serviceFeeDiscountApplied, cafeInquiry: order.cafeInquiry }))
    await order.save({ session })
  })
  order.$session(null)
}

export function clearZeroFeeSettlement(order: IOrder) { if (order.platformFee > 0) return; order.settlementStatus = 'not_due'; order.settlementDueAt = undefined; order.settlementFailureReason = undefined }

export async function saveOrderLifecycle(order: IOrder) {
  if (order.status !== 'completed' && order.status !== 'cancelled') { order.$where = { updatedAt: order.updatedAt, status: { $nin: ['completed', 'cancelled'] } }; await order.save(); return }
  const expectedUpdatedAt = order.updatedAt, changes = order.getChanges()
  const saved = await mongoose.connection.transaction(async session => {
    const updated = await Order.findOneAndUpdate({ _id: order._id, updatedAt: expectedUpdatedAt, status: { $ne: order.status } }, changes, { new: true, runValidators: true, session })
    if (!updated) throw new OrderChangedError()
    if (!updated.isTestOrder && updated.firstOrderBonusApplied && updated.firstOrderBonusSessionId) {
      if (updated.status === 'completed') {
        updated.firstOrderBonusConsumedAt ||= updated.completedAt || new Date()
        await FirstOrderBonusClaim.updateOne({ orderId: String(updated._id), sessionId: updated.firstOrderBonusSessionId }, { $set: { consumedAt: updated.firstOrderBonusConsumedAt } }, { session })
        await updated.save({ session })
      } else if (canReleaseFirstOrderReservation(updated)) {
        await FirstOrderBonusClaim.deleteOne({ orderId: String(updated._id), sessionId: updated.firstOrderBonusSessionId, consumedAt: { $exists: false } }, { session })
      }
    }
    return updated
  })
  order.set(saved.toObject())
}

export async function releaseCancelledBonus(order: IOrder) {
  if (!canReleaseFirstOrderReservation(order) || !order.firstOrderBonusSessionId) return
  await FirstOrderBonusClaim.deleteOne({ orderId: String(order._id), sessionId: order.firstOrderBonusSessionId, consumedAt: { $exists: false } })
}
