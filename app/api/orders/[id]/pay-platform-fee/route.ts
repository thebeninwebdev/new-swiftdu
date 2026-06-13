import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getAppBaseUrl, initializePaystackCheckout } from '@/lib/paystack-settlement'
import { getSettlementDueAt } from '@/lib/order-finance'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import { emitOrderUpdated } from '@/lib/socket'
import {
  PendingSettlementVerificationError,
  verifyAndMarkOrderSettlementPaid,
} from '@/lib/settlement-payment'
import { Order } from '@/models/order'
import { User } from '@/models/user'

function getCustomerLookupConditions(userId: string) {
  const conditions: Record<string, unknown>[] = [{ id: userId }]

  if (Types.ObjectId.isValid(userId)) {
    conditions.push({ _id: new Types.ObjectId(userId) })
  }

  return conditions
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.taskerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const order = await Order.findById(id)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.taskerId !== session.user.taskerId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      )
    }

    if (order.isTestOrder) {
      order.taskerHasPaid = true
      order.settlementStatus = 'paid'
      order.settlementPaidAt = order.settlementPaidAt || new Date()
      order.settlementFailureReason = undefined
      await order.save()
      emitOrderUpdated(order)

      return NextResponse.json({
        simulated: true,
        order,
        message: 'Training order - no real payment was made.',
      })
    }

    await syncTaskerSettlementStatus(String(session.user.taskerId))

    if (order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Platform settlement becomes payable after the task is completed.' },
        { status: 400 }
      )
    }

    if (order.taskerHasPaid || order.settlementStatus === 'paid') {
      return NextResponse.json(
        { error: 'The platform settlement for this task has already been paid.' },
        { status: 400 }
      )
    }

    if (
      !order.serviceFeeDiscountApplied &&
      Number(order.platformFee || 0) > 0 &&
      Number(order.serviceFee || order.commission || 0) > 0
    ) {
      const customerLookupConditions = getCustomerLookupConditions(String(order.userId))
      const discountCustomer = await User.findOneAndUpdate(
        {
          $or: customerLookupConditions,
          serviceFeeDiscountEnabled: true,
          serviceFeeDiscountRemainingOrders: { $gt: 0 },
        },
        { $inc: { serviceFeeDiscountRemainingOrders: -1 } },
        {
          new: true,
          projection:
            'serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders',
        }
      ).lean()

      if (discountCustomer) {
        const previousServiceFee = Number(order.serviceFee || order.commission || 0)
        const previousTaskerFee = Number(order.taskerFee || 0)
        let serviceFeeDiscountGrantedByName =
          discountCustomer.serviceFeeDiscountGrantedByName || undefined
        let serviceFeeDiscountGrantedByPhone =
          discountCustomer.serviceFeeDiscountGrantedByPhone || undefined

        if (
          discountCustomer.serviceFeeDiscountGrantedByUserId &&
          !serviceFeeDiscountGrantedByPhone
        ) {
          const grantorLookupConditions = getCustomerLookupConditions(
            String(discountCustomer.serviceFeeDiscountGrantedByUserId)
          )
          const grantor = grantorLookupConditions.length
            ? await User.findOne({ $or: grantorLookupConditions })
                .select('name phone email')
                .lean()
            : null

          serviceFeeDiscountGrantedByName =
            serviceFeeDiscountGrantedByName ||
            grantor?.name ||
            grantor?.email ||
            undefined
          serviceFeeDiscountGrantedByPhone =
            typeof grantor?.phone === 'string' && grantor.phone.trim()
              ? grantor.phone.trim()
              : undefined

          if (serviceFeeDiscountGrantedByPhone) {
            await User.findByIdAndUpdate(discountCustomer._id, {
              serviceFeeDiscountGrantedByName,
              serviceFeeDiscountGrantedByPhone,
            })
          }
        }

        if (Number(discountCustomer.serviceFeeDiscountRemainingOrders || 0) <= 0) {
          await User.findByIdAndUpdate(discountCustomer._id, {
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

        order.serviceFeeBeforeDiscount = previousServiceFee
        order.serviceFeeDiscountApplied = true
        order.serviceFeeDiscountGrantedByName = serviceFeeDiscountGrantedByName
        order.serviceFeeDiscountGrantedByPhone = serviceFeeDiscountGrantedByPhone
        order.discountCommissionAmount =
          order.pricingModel === 'tiered'
            ? previousTaskerFee || previousServiceFee
            : previousServiceFee
        order.commission = 0
        order.platformFee = 0
        order.serviceFee = 0
        order.taskerFee = order.pricingModel === 'tiered' ? 0 : previousTaskerFee
        order.totalAmount = Math.max(
          0,
          Number(order.totalAmount || 0) - previousServiceFee
        )
        order.settlementProvider = undefined
        order.settlementStatus = 'not_due'
        order.settlementReference = undefined
        order.settlementAccessCode = undefined
        order.settlementCheckoutUrl = undefined
        order.settlementTransactionId = undefined
        order.settlementInitializedAt = undefined
        order.settlementFailureReason = undefined

        await order.save()
        await syncTaskerSettlementStatus(String(session.user.taskerId))
        emitOrderUpdated(order)

        return NextResponse.json({
          discountApplied: true,
          order,
          message: 'The customer service fee discount covered this platform settlement.',
        })
      }
    }

    if (!order.platformFee || order.platformFee <= 0) {
      return NextResponse.json(
        { error: 'This order does not have a platform settlement amount.' },
        { status: 400 }
      )
    }

    const existingSettlementReference = String(order.settlementReference || '').trim()
    const existingCheckoutUrl = String(order.settlementCheckoutUrl || '').trim()

    if (
      existingSettlementReference &&
      (order.settlementStatus === 'initialized' || order.settlementStatus === 'pending')
    ) {
      try {
        const updatedOrder = await verifyAndMarkOrderSettlementPaid({
          order,
          reference: existingSettlementReference,
        })

        await syncTaskerSettlementStatus(String(session.user.taskerId))
        emitOrderUpdated(updatedOrder)

        return NextResponse.json({
          alreadyPaid: true,
          order: updatedOrder,
          reference: existingSettlementReference,
        })
      } catch (error) {
        if (error instanceof PendingSettlementVerificationError && existingCheckoutUrl) {
          emitOrderUpdated(error.order)

          return NextResponse.json({
            checkoutUrl: existingCheckoutUrl,
            reference: existingSettlementReference,
            pending: true,
          })
        }

        if (!(error instanceof PendingSettlementVerificationError)) {
          console.warn(
            '[POST /api/orders/[id]/pay-platform-fee] Existing settlement check failed',
            error
          )
        }
      }
    }

    const reference = `swiftdu-settlement-${order._id.toString()}-${Date.now()}`
    const callbackUrl = `${getAppBaseUrl(
      request.nextUrl.origin
    )}/api/orders/${order._id.toString()}/pay-platform-fee/callback`
    const fullName = String(session.user.name || 'Tasker').trim() || 'Tasker'
    const email =
      String(session.user.email || '').trim() ||
      `tasker-${session.user.id}@swiftdu.org`

    const checkout = await initializePaystackCheckout({
      amount: Number(order.platformFee || 0),
      email,
      reference,
      customer_name: fullName,
      phone: session.user.phone || undefined,
      callback_url: callbackUrl,
      metadata: {
        orderId: order._id.toString(),
        taskerId: session.user.taskerId,
        taskerUserId: session.user.id,
        settlementType: 'platform_fee',
      },
    })

    const checkoutUrl = checkout.data?.authorization_url
    const accessCode = checkout.data?.access_code

    if (!checkoutUrl) {
      throw new Error('Paystack did not return a checkout URL.')
    }

    order.settlementProvider = 'paystack'
    order.settlementStatus = 'initialized'
    order.settlementReference = reference
    order.settlementAccessCode = accessCode || undefined
    order.settlementCheckoutUrl = checkoutUrl
    order.settlementTransactionId = undefined
    order.settlementInitializedAt = new Date()
    order.settlementDueAt =
      order.settlementDueAt || getSettlementDueAt(order.completedAt || new Date())
    order.settlementFailureReason = undefined
    await order.save()

    emitOrderUpdated(order)

    return NextResponse.json({
      checkoutUrl,
      reference,
    })
  } catch (error) {
    console.error('[POST /api/orders/[id]/pay-platform-fee]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize Paystack settlement.',
      },
      { status: 500 }
    )
  }
}
