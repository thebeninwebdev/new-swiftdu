import mongoose, { type ClientSession } from 'mongoose'
import { Order, type IOrder } from '@/models/order'
import { User } from '@/models/user'
import { WhatsAppRegistration } from '@/models/whatsapp-registration'
import { getUserLookupConditions } from './service-fee-discount'
import { canReleaseFirstOrderReservation, priceWithOrderDiscounts } from './first-order-pricing'
import type { PricingResult } from './pricing'

export class OrderChangedError extends Error {
  constructor() { super('Order changed. Refresh and try again.') }
}

async function customerIdentity(userId: string, session?: ClientSession) {
  const user = await User.findOne({ $or: getUserLookupConditions({ id: userId }) }).session(session || null)
  if (!user) return null // Never mint another entitlement from an unverified phone.
  const ids = [...new Set([userId, String(user._id), ...(user.id ? [String(user.id)] : [])])]
  const links = await WhatsAppRegistration.find({ userId: { $in: ids }, status: 'linked' }).session(session || null).lean()
  const phones = links.flatMap(link => {
    const phone = String(link.phone).replace(/\D/g, '')
    return [phone, `+${phone}`, ...(phone.startsWith('234') ? [`0${phone.slice(3)}`] : [])]
  })
  return { user, history: { $or: [{ userId: { $in: ids } }, ...(phones.length ? [{ source: 'whatsapp', customerPhone: { $in: phones } }] : [])] } }
}

async function hasLiveHistory(history: Record<string, unknown>, session?: ClientSession) {
  return Boolean(await Order.exists({ isTestOrder: { $ne: true },
    $and: [history, { $or: [{ status: 'completed' }, { firstOrderBonusConsumedAt: { $exists: true } }] }],
  }).session(session || null))
}

export async function firstOrderBonusAvailable(userId: string) {
  const identity = await customerIdentity(userId)
  if (!identity || identity.user.firstOrderBonusConsumedAt || identity.user.firstOrderBonusOrderId) return false
  return !await hasLiveHistory(identity.history)
}

// Creation, completion and cancellation serialize on the same customer document.
// MongoDB transactions ensure a crash cannot leave a reservation without its order.
async function lockCustomer(userId: string, session: ClientSession) {
  const identity = await customerIdentity(userId, session)
  if (!identity) return null
  identity.user = await User.findOneAndUpdate({ _id: identity.user._id },
    { $inc: { firstOrderBonusVersion: 1 } }, { new: true, session })
  return identity
}

export async function saveNewOrderWithBonus(order: IOrder, pricing: PricingResult) {
  if (order.isTestOrder) {
    Object.assign(order, priceWithOrderDiscounts(pricing, { serviceFeeDiscount: order.serviceFeeDiscountApplied, cafeInquiry: order.cafeInquiry }))
    await order.save(); return
  }
  await mongoose.connection.transaction(async session => {
    const identity = await lockCustomer(order.userId, session)
    let eligible = false
    if (identity && !identity.user.firstOrderBonusConsumedAt) {
      const reservedId = identity.user.firstOrderBonusOrderId
      // Repair a reservation left by an older cancellation flow, but never a
      // paid or missing order: those require an explicit administrative review.
      if (reservedId) {
        const reserved = await Order.findById(reservedId).session(session)
        if (reserved && canReleaseFirstOrderReservation(reserved)) {
          identity.user.firstOrderBonusOrderId = undefined
        }
      }
      eligible = !identity.user.firstOrderBonusOrderId && !await hasLiveHistory(identity.history, session)
      if (eligible) {
        identity.user.firstOrderBonusOrderId = String(order._id)
        await identity.user.save({ session })
      }
    }
    Object.assign(order, priceWithOrderDiscounts(pricing, {
      firstOrderBonus: eligible, serviceFeeDiscount: order.serviceFeeDiscountApplied, cafeInquiry: order.cafeInquiry,
    }))
    await order.save({ session })
  })
  order.$session(null)
}

export function clearZeroFeeSettlement(order: IOrder) {
  if (order.platformFee > 0) return
  order.settlementStatus = 'not_due'
  order.settlementDueAt = undefined
  order.settlementFailureReason = undefined
  // No Paystack reference, payment timestamp or successful payment is fabricated.
}

export async function saveOrderLifecycle(order: IOrder) {
  if (order.status !== 'completed' && order.status !== 'cancelled') {
    order.$where = { updatedAt: order.updatedAt, status: { $nin: ['completed', 'cancelled'] } }
    await order.save(); return
  }
  const expectedUpdatedAt = order.updatedAt
  const changes = order.getChanges()
  const saved = await mongoose.connection.transaction(async session => {
    const identity = order.isTestOrder ? null : await lockCustomer(order.userId, session)
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, updatedAt: expectedUpdatedAt, status: { $ne: order.status } }, changes, { new: true, runValidators: true, session },
    )
    if (!updated) throw new OrderChangedError()
    if (identity) {
      if (updated.status === 'completed') {
        identity.user.firstOrderBonusConsumedAt ||= updated.completedAt || new Date()
        // Keep a different paid reservation intact if orders finish out of order.
        if (identity.user.firstOrderBonusOrderId === String(updated._id)) identity.user.firstOrderBonusOrderId = undefined
        if (updated.firstOrderBonusApplied) {
          updated.firstOrderBonusConsumedAt ||= identity.user.firstOrderBonusConsumedAt
          await updated.save({ session })
        }
      } else if (canReleaseFirstOrderReservation(updated) && identity.user.firstOrderBonusOrderId === String(updated._id)) {
        identity.user.firstOrderBonusOrderId = undefined
      }
      await identity.user.save({ session })
    }
    return updated
  })
  order.set(saved.toObject())
}

// Expiry already uses an atomic unpaid cancellation. Release only its exact claim.
export async function releaseCancelledBonus(order: IOrder) {
  if (!canReleaseFirstOrderReservation(order)) return
  await User.updateOne({ $or: getUserLookupConditions({ id: order.userId }), firstOrderBonusOrderId: String(order._id) },
    { $unset: { firstOrderBonusOrderId: 1 } })
}
