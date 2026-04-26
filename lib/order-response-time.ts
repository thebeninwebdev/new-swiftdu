type DateLike = Date | string | null | undefined

type OrderResponseTimeInput = {
  bookedAt?: DateLike
  createdAt?: DateLike
  acceptedAt?: DateLike
  cancelledAt?: DateLike
}

type OrderWithBookedAt = {
  bookedAt?: DateLike
  createdAt?: DateLike
}

export type OrderResponseOutcome = 'accepted' | 'cancelled'

function parseDate(value: DateLike) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function resolveBookedAt(input: OrderWithBookedAt) {
  return parseDate(input.bookedAt) || parseDate(input.createdAt)
}

export function ensureBookedAt<T extends OrderWithBookedAt>(order: T) {
  const bookedAt = resolveBookedAt(order) || new Date()

  if (!order.bookedAt) {
    order.bookedAt = bookedAt
  }

  return bookedAt
}

export function getOrderResponseTime(input: OrderResponseTimeInput) {
  const bookedAt = resolveBookedAt(input)
  const acceptedAt = parseDate(input.acceptedAt)
  const cancelledAt = parseDate(input.cancelledAt)
  const firstResponseAt = acceptedAt || cancelledAt
  const responseOutcome: OrderResponseOutcome | null = acceptedAt
    ? 'accepted'
    : cancelledAt
      ? 'cancelled'
      : null

  return {
    bookedAt,
    firstResponseAt,
    responseOutcome,
    responseTimeMs:
      bookedAt && firstResponseAt
        ? Math.max(firstResponseAt.getTime() - bookedAt.getTime(), 0)
        : null,
  }
}
