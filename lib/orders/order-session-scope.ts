import 'server-only'

import { AcademicSession } from '@/models/academic-session'
import type { OrderSessionWindow } from './order-session-filter'

export { applyCurrentSessionOrderScope, buildCurrentSessionOrderFilter } from './order-session-filter'

export type ActiveOrderSession = OrderSessionWindow

export class NoActiveOrderSessionError extends Error {
  readonly code = 'NO_ACTIVE_SESSION'
  readonly status = 409

  constructor() {
    super('No active academic session is configured.')
    this.name = 'NoActiveOrderSessionError'
  }
}

export async function getActiveAcademicSession(): Promise<ActiveOrderSession> {
  const session = await AcademicSession.findOne({ isActive: true })
    .select('_id name startDate endDate')
    .lean()

  if (!session) throw new NoActiveOrderSessionError()

  return {
    id: session._id.toString(),
    name: session.name,
    startDate: session.startDate,
    endDate: session.endDate,
  }
}

export function serializeOrderSession(session: ActiveOrderSession) {
  return {
    id: session.id,
    name: session.name,
    startDate: session.startDate,
    endDate: session.endDate,
  }
}
