import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ensureCompletionTimer, getCompletionWindowMinutes } from './completion-timer'

test('all live tasks receive 25 minutes, including legacy orders without a mode flag', () => {
  for (const location of ['Library', 'Girls Hostel', 'Amnesty', 'Staff Quarters']) {
    for (const taskType of ['restaurant', 'indomie', 'water', 'copy_notes']) {
      assert.equal(getCompletionWindowMinutes(location, taskType, false), 25)
      assert.equal(getCompletionWindowMinutes(location, taskType), 25)
    }
  }
})

test('training uses the exact same completion window as live orders', () => {
  for (const [location, taskType] of [['Library', 'restaurant'], ['Girls Hostel', 'restaurant'], ['Staff Quarters', 'restaurant'], ['Library', 'indomie']] as const) {
    assert.equal(getCompletionWindowMinutes(location, taskType, true), getCompletionWindowMinutes(location, taskType, false))
  }
})

test('live payment starts a 25-minute timer and preserves existing longer deadlines', () => {
  const paidAt = new Date('2026-10-01T12:00:00Z')
  const order: Parameters<typeof ensureCompletionTimer>[0] = {
    hasPaid: true, status: 'accepted', paidAt, taskType: 'indomie', location: 'Staff Quarters',
  }
  assert.equal(ensureCompletionTimer(order), true)
  assert.equal(order.completionWindowMinutes, 25)
  assert.equal(order.completionDueAt?.getTime(), paidAt.getTime() + 25 * 60000)
  order.completionWindowMinutes = 60
  order.completionDueAt = new Date(paidAt.getTime() + 60 * 60000)
  assert.equal(ensureCompletionTimer(order), false)
  assert.equal(order.completionDueAt.getTime(), paidAt.getTime() + 60 * 60000)
})

test('shorter live timers are extended to 25 minutes with granted extensions retained', () => {
  const started = new Date('2026-10-01T12:00:00Z')
  const order = {
    hasPaid: true, status: 'accepted', paidAt: started, completionWindowMinutes: 20,
    completionExtensionMinutes: 10, completionDueAt: new Date(started.getTime() + 30 * 60000),
  }
  assert.equal(ensureCompletionTimer(order), true)
  assert.equal(order.completionDueAt.getTime(), started.getTime() + 35 * 60000)
})

test('cafe inquiries never receive a completion timer and clear a legacy one', () => {
  const order: Parameters<typeof ensureCompletionTimer>[0] = {
    cafeInquiry: true, hasPaid: true, status: 'in_progress', paidAt: new Date('2026-10-01T12:00:00Z'),
    completionTimerStartedAt: new Date('2026-10-01T12:00:00Z'), completionWindowMinutes: 25,
    completionExtensionMinutes: 10, completionDueAt: new Date('2026-10-01T12:35:00Z'),
  }
  assert.equal(ensureCompletionTimer(order), true)
  assert.equal(order.completionTimerStartedAt, undefined)
  assert.equal(order.completionWindowMinutes, undefined)
  assert.equal(order.completionDueAt, undefined)
  assert.equal(ensureCompletionTimer(order), false)
})
