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
  await User.updateOne({ _id: userId }, { $inc: { firstOrderBonusVersion: 1 } }, { session })
  return userId
}

type SaveOrderOptions = { correlationId?: string }

const MAX_TRANSACTION_ATTEMPTS = 8
const MAX_COMMIT_ATTEMPTS = 3
const MAX_RETRY_DELAY_MS = 200

function errorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error ? (error as { code?: number }).code : undefined
}

function hasErrorLabel(error: unknown, label: string) {
  return typeof error === 'object' && error && 'hasErrorLabel' in error &&
    typeof (error as { hasErrorLabel?: (name: string) => boolean }).hasErrorLabel === 'function' &&
    (error as { hasErrorLabel: (name: string) => boolean }).hasErrorLabel(label)
}

function isRetryableTransactionError(error: unknown) {
  const code = errorCode(error)
  return hasErrorLabel(error, 'TransientTransactionError') || code === 112 || code === 251 || code === 11000
}

async function findCommittedOrder(order: IOrder) {
  if (order.idempotencyKey) {
    const byKey = await Order.findOne({ userId: order.userId, idempotencyKey: order.idempotencyKey }).lean()
    if (byKey) return byKey
  }
  return Order.findOne({ _id: order._id, userId: order.userId }).lean()
}

function applyCommittedOrder(order: IOrder, committed: Partial<IOrder>) {
  order.set(committed)
  order.isNew = false
  order.$session(null)
  return order
}

export async function saveNewOrderWithBonus(order: IOrder, pricing: PricingResult, options: SaveOrderOptions = {}) {
  const startedAt = performance.now()
  const correlationId = options.correlationId || String(order._id)
  const log = (checkpoint: string, fields: Record<string, unknown> = {}) => console.info('[Order persistence]', {
    correlationId, checkpoint, durationMs: Math.round(performance.now() - startedAt), ...fields,
  })

  if (order.isTestOrder) {
    Object.assign(order, priceWithOrderDiscounts(pricing, { serviceFeeDiscount: order.serviceFeeDiscountApplied, cafeInquiry: order.cafeInquiry }))
    await order.save(); return
  }

  const orderSnapshot = order.toObject({ depopulate: true, getters: false, virtuals: false, transform: false })
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    const alreadyCommitted = await findCommittedOrder(order)
    if (alreadyCommitted) {
      log('existing_order_returned', { retryAttempt: attempt - 1, bonusApplied: Boolean(alreadyCommitted.firstOrderBonusApplied) })
      applyCommittedOrder(order, alreadyCommitted)
      return
    }

    const session = await mongoose.connection.startSession()
    const attemptOrder = new Order(orderSnapshot)
    let bonusApplied = false
    try {
      session.startTransaction({ maxCommitTimeMS: 5_000 })
      const current = await activeSession(session)
      const customerId = await lockCustomer(order.userId, session)
      const existingClaim = await FirstOrderBonusClaim.exists({ userId: customerId, sessionId: current._id }).session(session)
      log('bonus_eligibility_checked', { retryAttempt: attempt, bonusApplied: !existingClaim })

      if (existingClaim) {
        log('bonus_claim_existing', { retryAttempt: attempt, bonusApplied: false })
      } else {
        log('bonus_reservation_started', { retryAttempt: attempt, bonusApplied: false })
        await FirstOrderBonusClaim.create([{
          userId: customerId,
          sessionId: current._id,
          orderId: String(attemptOrder._id),
          claimedAt: new Date(),
        }], { session })
        bonusApplied = true
        log('bonus_reservation_succeeded', { retryAttempt: attempt, bonusApplied: true })
      }

      attemptOrder.sessionId = current._id
      attemptOrder.sessionName = current.name
      attemptOrder.firstOrderBonusSessionId = bonusApplied ? current._id : undefined
      Object.assign(attemptOrder, priceWithOrderDiscounts(pricing, {
        firstOrderBonus: bonusApplied,
        serviceFeeDiscount: attemptOrder.serviceFeeDiscountApplied,
        cafeInquiry: attemptOrder.cafeInquiry,
      }))
      log('order_save_started', { retryAttempt: attempt, bonusApplied })
      await attemptOrder.save({ session })
      log('order_save_completed', { retryAttempt: attempt, bonusApplied })

      let committed = false
      for (let commitAttempt = 1; commitAttempt <= MAX_COMMIT_ATTEMPTS; commitAttempt++) {
        try {
          await session.commitTransaction()
          committed = true
          break
        } catch (error) {
          const persisted = await findCommittedOrder(order)
          if (persisted) {
            applyCommittedOrder(order, persisted)
            log('transaction_commit_completed', { retryAttempt: attempt, bonusApplied: Boolean(persisted.firstOrderBonusApplied), commitOutcomeChecked: true })
            return
          }
          if (!hasErrorLabel(error, 'UnknownTransactionCommitResult') || commitAttempt === MAX_COMMIT_ATTEMPTS) throw error
        }
      }
      if (!committed) throw new Error('Order transaction commit did not complete.')
      applyCommittedOrder(order, attemptOrder.toObject({ depopulate: true, getters: false, virtuals: false, transform: false }))
      log('transaction_commit_completed', { retryAttempt: attempt, bonusApplied })
      return
    } catch (error) {
      lastError = error
      if (!hasErrorLabel(error, 'UnknownTransactionCommitResult') && session.inTransaction()) {
        await session.abortTransaction().catch(() => undefined)
      }

      let persisted: Awaited<ReturnType<typeof findCommittedOrder>>
      try {
        persisted = await findCommittedOrder(order)
      } catch {
        throw error
      }
      if (persisted) {
        applyCommittedOrder(order, persisted)
        log('transaction_commit_completed', { retryAttempt: attempt, bonusApplied: Boolean(persisted.firstOrderBonusApplied), commitOutcomeChecked: true })
        return
      }

      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
        console.error('[Order persistence]', {
          correlationId, checkpoint: 'transaction_failed', durationMs: Math.round(performance.now() - startedAt),
          retryAttempt: attempt, errorCode: errorCode(error), errorName: error instanceof Error ? error.name : 'UnknownError', bonusApplied,
        })
        throw error
      }
      const retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, 10 * attempt)
      log('transaction_retry_started', { retryAttempt: attempt + 1, errorCode: errorCode(error), bonusApplied, retryDelayMs })
      await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    } finally {
      await session.endSession()
    }
  }
  throw lastError
}

export function clearZeroFeeSettlement(order: IOrder) { if (order.platformFee > 0) return; order.settlementStatus = 'not_due'; order.settlementDueAt = undefined; order.settlementFailureReason = undefined }

export async function saveOrderLifecycle(order: IOrder) {
  if (order.status !== 'completed' && order.status !== 'cancelled') { order.$where = { updatedAt: order.updatedAt, status: { $nin: ['completed', 'cancelled'] } }; await order.save(); return }
  const expectedUpdatedAt = order.updatedAt, changes = order.getChanges()
  const saved = await mongoose.connection.transaction(async session => {
    const updated = await Order.findOneAndUpdate({ _id: order._id, updatedAt: expectedUpdatedAt, status: { $ne: order.status } }, changes, { returnDocument: 'after', runValidators: true, session })
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
