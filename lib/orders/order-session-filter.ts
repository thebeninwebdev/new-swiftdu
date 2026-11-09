import { Types, type QueryFilter } from 'mongoose'

import type { IOrder } from '@/models/order'

export type OrderSessionWindow = {
  id: string
  name: string
  startDate: Date
  endDate: Date
}
export function buildCurrentSessionOrderFilter(
  session: OrderSessionWindow
): QueryFilter<IOrder> {
  const sessionObjectId = Types.ObjectId.isValid(session.id) ? new Types.ObjectId(session.id) : null
  const sessionMatch = sessionObjectId
    ? { sessionId: { $in: [session.id, sessionObjectId] } }
    : { sessionId: session.id }

  return {
    $or: [
      sessionMatch,
      {
        $and: [
          { $or: [{ sessionId: { $exists: false } }, { sessionId: null }] },
          { createdAt: { $gte: session.startDate, $lte: session.endDate } },
        ],
      },
    ],
  }
}

export function applyCurrentSessionOrderScope(
  filter: QueryFilter<IOrder>,
  session: OrderSessionWindow
): QueryFilter<IOrder> {
  return { $and: [filter, buildCurrentSessionOrderFilter(session)] }
}
