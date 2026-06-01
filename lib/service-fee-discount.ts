import { Types } from 'mongoose'

import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status'
import { Order } from '@/models/order'
import { User } from '@/models/user'

export function getUserLookupConditions({
  id,
  email,
}: {
  id?: string | null
  email?: string | null
}) {
  const conditions: Record<string, unknown>[] = []

  if (id) {
    conditions.push({ id })

    if (Types.ObjectId.isValid(id)) {
      conditions.push({ _id: new Types.ObjectId(id) })
    }
  }

  if (email) {
    conditions.push({ email: email.trim().toLowerCase() })
  }

  return conditions
}

export async function hasActiveServiceFeeDiscountReservation(userId: string) {
  const activeDiscountedOrder = await Order.exists({
    userId,
    serviceFeeDiscountApplied: true,
    status: { $in: [...ACTIVE_ORDER_STATUSES] },
  })

  return Boolean(activeDiscountedOrder)
}

export async function consumeServiceFeeDiscountForCompletedOrder(order: {
  userId?: string | null
  serviceFeeDiscountApplied?: boolean
}) {
  if (!order.serviceFeeDiscountApplied || !order.userId) {
    return
  }

  const lookupConditions = getUserLookupConditions({ id: String(order.userId) })

  if (lookupConditions.length === 0) {
    return
  }

  const updatedDiscountUser = await User.findOneAndUpdate(
    {
      $or: lookupConditions,
      serviceFeeDiscountRemainingOrders: { $gt: 0 },
    },
    { $inc: { serviceFeeDiscountRemainingOrders: -1 } },
    {
      new: true,
      projection: 'serviceFeeDiscountRemainingOrders',
    }
  ).lean()

  if (
    updatedDiscountUser &&
    Number(updatedDiscountUser.serviceFeeDiscountRemainingOrders || 0) <= 0
  ) {
    await User.findByIdAndUpdate(updatedDiscountUser._id, {
      $set: {
        serviceFeeDiscountEnabled: false,
        serviceFeeDiscountRemainingOrders: 0,
      },
      $unset: {
        serviceFeeDiscountGrantedByUserId: '',
        serviceFeeDiscountGrantedByName: '',
        serviceFeeDiscountGrantedByPhone: '',
        serviceFeeDiscountGrantedAt: '',
      },
    })
  }
}
