import assert from 'node:assert/strict'
import test from 'node:test'
import { optimisticWorkSnapshot, type WorkSnapshot } from './tasker-work'

const snapshot: WorkSnapshot = {
  taskerId: 'tasker-1',
  status: 'offline',
  checkedIn: false,
  checkedInAt: null,
  activeTasks: 0,
  mode: 'live',
  canCheckIn: true,
  blockedReason: null,
  serverNow: '2026-11-11T10:00:00.000Z',
  summaries: {
    today: { tasks: 0, earnings: 0, activeMs: 0 },
    week: { tasks: 0, earnings: 0, activeMs: 0 },
    month: { tasks: 0, earnings: 0, activeMs: 0 },
  },
}

test('check-in projects an immediate reversible available state', () => {
  const optimistic = optimisticWorkSnapshot(snapshot, 'check-in', new Date('2026-11-11T10:01:00.000Z'))
  assert.equal(optimistic.checkedIn, true)
  assert.equal(optimistic.status, 'available')
  assert.equal(optimistic.checkedInAt, '2026-11-11T10:01:00.000Z')
  assert.equal(snapshot.checkedIn, false, 'the rollback snapshot is not mutated')
})

test('check-out projects offline but preserves busy authority until confirmation', () => {
  const busy = { ...snapshot, checkedIn: true, status: 'busy' as const, activeTasks: 1 }
  const optimistic = optimisticWorkSnapshot(busy, 'check-out')
  assert.equal(optimistic.checkedIn, false)
  assert.equal(optimistic.status, 'busy')
  assert.equal(optimistic.checkedInAt, null)
})
