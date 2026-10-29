import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyCurrentSessionOrderScope,
  buildCurrentSessionOrderFilter,
} from './order-session-filter'

const session = {
  id: '507f191e810c19729de860ea',
  name: '2026/2027',
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2027-08-31T23:59:59.999Z'),
}

test('current-session scope includes assigned and date-compatible legacy orders', () => {
  const filter = buildCurrentSessionOrderFilter(session)
  assert.deepEqual(filter.$or?.[0], { sessionId: session.id })
  assert.deepEqual(filter.$or?.[1], {
    $and: [
      { $or: [{ sessionId: { $exists: false } }, { sessionId: null }] },
      { createdAt: { $gte: session.startDate, $lte: session.endDate } },
    ],
  })
})

test('scope composes without overwriting a caller or-clause', () => {
  const caller = { $or: [{ status: 'pending' }, { status: 'paid' }] }
  const scoped = applyCurrentSessionOrderScope(caller, session)
  assert.equal(scoped.$and?.[0], caller)
  assert.deepEqual(scoped.$and?.[1], buildCurrentSessionOrderFilter(session))
})
