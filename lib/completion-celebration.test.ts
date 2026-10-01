import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claimCompletionCelebration, formatCompletionDuration, getCompletionRecognition } from './completion-celebration'
import { mergeOrderUpdate } from './order-sync'

const start = Date.parse('2026-09-30T10:00:00Z')
const order = { _id: 'one', status: 'completed', completionTimerStartedAt: new Date(start).toISOString(), completionWindowMinutes: 30, completedAt: new Date(start + 1199000).toISOString() }

test('strict two-thirds boundary, including milliseconds', () => {
  for (const [elapsed, eligible] of [[1199000, true], [1199999, true], [1200000, false], [1200001, false], [1201000, false], [0, true]] as const) {
    assert.equal(getCompletionRecognition({ ...order, completedAt: new Date(start + elapsed) }).eligible, eligible)
  }
})

test('missing, invalid, negative timing and absent persisted window cannot qualify', () => {
  for (const patch of [{ completedAt: undefined }, { completedAt: 'invalid' }, { completionTimerStartedAt: '' }, { completionTimerStartedAt: new Date(NaN) }, { completedAt: new Date(start - 1) }, { completionWindowMinutes: undefined }, { completionWindowMinutes: 0 }, { completionWindowMinutes: Infinity }, { completionWindowMinutes: -5 }]) {
    assert.equal(getCompletionRecognition({ ...order, ...patch }).eligible, false)
  }
})

test('extensions and current location defaults are irrelevant; reports suppress recognition', () => {
  const extended = { ...order, completedAt: new Date(start + 1200000), completionExtensionMinutes: 60, location: 'staff quarters', createdAt: new Date(start - 900000) }
  assert.equal(getCompletionRecognition(extended).eligible, false)
  for (const patch of [{ prematureCompletionReported: true }, { customerReceiptConfirmed: false }, { status: 'paid' }]) assert.equal(getCompletionRecognition({ ...order, ...patch }).eligible, false)
  for (const patch of [{ isTestOrder: true }, { cafeInquiry: true }, { deadline: '2026-10-01' }]) assert.equal(getCompletionRecognition({ ...order, ...patch }).eligible, true)
})

test('duration formatting retains seconds and subsecond boundary precision', () => {
  assert.equal(formatCompletionDuration(720000), '12 min')
  assert.equal(formatCompletionDuration(1199000), '19 min 59 sec')
  assert.equal(formatCompletionDuration(1199999), '19 min 59.999 sec')
  assert.equal(formatCompletionDuration(0), '0 sec')
})

test('memory and session guards deduplicate per tasker and order, including blocked storage', () => {
  const entries = new Map<string, string>()
  const storage = { getItem: (key: string) => entries.get(key) || null, setItem: (key: string, value: string) => { entries.set(key, value) } }
  assert.equal(claimCompletionCelebration('a', 'one', storage), true)
  assert.equal(claimCompletionCelebration('a', 'one', storage), false)
  assert.equal(claimCompletionCelebration('b', 'one', storage), true)
  assert.equal(claimCompletionCelebration('a', 'two', { getItem: () => '1', setItem: () => assert.fail() }), false)
  const blocked = { getItem: () => { throw Error('blocked') }, setItem: () => {} }
  assert.equal(claimCompletionCelebration('a', 'three', blocked), true)
  assert.equal(claimCompletionCelebration('a', 'three', blocked), false)
})

test('merge preserves receipt reports over a stale successful completion response', () => {
  const reported = { ...order, updatedAt: '2026-09-30T11:02:00Z', prematureCompletionReported: true }
  const merged = mergeOrderUpdate(reported, { ...order, updatedAt: '2026-09-30T11:01:00Z' })
  assert.equal(getCompletionRecognition(merged).eligible, false)
})
