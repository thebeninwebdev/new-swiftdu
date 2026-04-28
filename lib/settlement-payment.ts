import { getSettlementDueAt } from '@/lib/order-finance'
import { verifyPaystackPayment } from '@/lib/paystack-settlement'
import { Order, type IOrder } from '@/models/order'

interface VerifySettlementInput {
  order: IOrder
  reference?: string
  transactionId?: string | number
}

function normalizeString(value?: string | number | null) {
  return String(value || '').trim()
}

function isTransactionNotReadyError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return /no transaction was found/i.test(error.message)
}

async function markOrderSettlementPending({
  order,
  reference,
  transactionId,
}: VerifySettlementInput) {
  const updatedOrder = await Order.findByIdAndUpdate(
    order._id,
    {
      $set: {
        settlementProvider: 'paystack',
        settlementStatus: 'pending',
        settlementReference:
          normalizeString(reference || order.settlementReference) || undefined,
        settlementTransactionId:
          normalizeString(transactionId || order.settlementTransactionId) ||
          undefined,
        settlementDueAt:
          order.settlementDueAt ||
          getSettlementDueAt(order.completedAt || new Date()),
      },
      $unset: {
        settlementFailureReason: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  )

  if (!updatedOrder) {
    throw new Error('Order not found while saving settlement verification.')
  }

  return updatedOrder
}

export class PendingSettlementVerificationError extends Error {
  order: IOrder

  constructor(message: string, order: IOrder) {
    super(message)
    this.name = 'PendingSettlementVerificationError'
    this.order = order
  }
}

export async function verifyAndMarkOrderSettlementPaid({
  order,
  reference,
  transactionId,
}: VerifySettlementInput) {
  if (order.taskerHasPaid && order.settlementStatus === 'paid') {
    return order
  }

  const resolvedReference = normalizeString(reference || order.settlementReference)
  const resolvedTransactionId = normalizeString(transactionId)

  if (!resolvedReference && !resolvedTransactionId) {
    throw new Error('Missing Paystack settlement reference.')
  }

  let verification

  try {
    // Paystack uses reference for verification, not transactionId
    const referenceToVerify = resolvedReference || resolvedTransactionId
    verification = await verifyPaystackPayment(referenceToVerify)
  } catch (error) {
    if (isTransactionNotReadyError(error)) {
      const pendingOrder = await markOrderSettlementPending({
        order,
        reference: resolvedReference,
        transactionId: resolvedTransactionId,
      })

      throw new PendingSettlementVerificationError(
        'Payment is still awaiting Paystack confirmation.',
        pendingOrder
      )
    }

    throw error
  }

  const transaction = verification.data

  if (!transaction) {
    throw new Error('Paystack verification returned no transaction data.')
  }

  const verifiedStatus = normalizeString(transaction.status).toLowerCase()
  const verifiedAmount = Number(transaction.amount || 0) / 100 // Convert from kobo
  const verifiedCurrency = normalizeString(transaction.currency).toUpperCase()
  const verifiedReference = normalizeString(transaction.reference || resolvedReference)
  const expectedAmount = Number(order.platformFee || 0)
  const amountsMatch =
    Math.round(verifiedAmount * 100) === Math.round(expectedAmount * 100)
  const resolvedVerificationTransactionId = normalizeString(
    transaction.id || resolvedTransactionId || order.settlementTransactionId
  )

  if (verifiedStatus === 'pending') {
    const pendingOrder = await markOrderSettlementPending({
      order,
      reference: verifiedReference || resolvedReference,
      transactionId: resolvedVerificationTransactionId,
    })

    throw new PendingSettlementVerificationError(
      'Payment is still awaiting Paystack confirmation.',
      pendingOrder
    )
  }

  if (
    verifiedStatus !== 'success' ||
    verifiedCurrency !== 'NGN' ||
    (resolvedReference && verifiedReference !== resolvedReference) ||
    !amountsMatch
  ) {
    const failedOrder = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          settlementStatus: 'failed',
          settlementReference: verifiedReference || resolvedReference || undefined,
          settlementTransactionId: resolvedVerificationTransactionId || undefined,
          settlementFailureReason:
            'Paystack verification did not match the expected settlement details.',
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!failedOrder) {
      throw new Error('Order not found while saving settlement verification.')
    }

    throw new Error('Paystack settlement verification failed.')
  }

  const settlementPaidAt = new Date(
    normalizeString(transaction.paid_at || transaction.created_at) ||
      new Date().toISOString()
  )
  const settlementDueAt =
    order.settlementDueAt || getSettlementDueAt(order.completedAt || new Date())
  const updatedOrder = await Order.findByIdAndUpdate(
    order._id,
    {
      $set: {
        taskerHasPaid: true,
        settlementProvider: 'paystack',
        settlementStatus: 'paid',
        settlementReference: verifiedReference || resolvedReference || undefined,
        settlementTransactionId: resolvedVerificationTransactionId || undefined,
        settlementPaidAt,
        settlementDueAt,
      },
      $unset: {
        settlementFailureReason: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  )

  if (!updatedOrder) {
    throw new Error('Order not found while saving settlement verification.')
  }

  return updatedOrder
}
