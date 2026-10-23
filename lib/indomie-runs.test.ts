import assert from 'node:assert/strict'
import test from 'node:test'
import { getNextAvailableIndomieRun, getNextTrainingIndomieRun, isIndomieRunPeriod, isRunStillBookable } from './indomie-runs'

const settings = { startMinute: 18 * 60, endMinute: 21 * 60, runIntervalMinutes: 30, bookingCutoffMinutes: 10 }
// Africa/Lagos is UTC+1 and has no daylight-saving transition.
const lagos = (hour: number, minute: number, second = 0) => new Date(Date.UTC(2026, 9, 18, hour - 1, minute, second))

test('server schedule transitions from normal service at 5:59 PM to batching at 6:00 PM Lagos time', () => {
  assert.equal(isIndomieRunPeriod(lagos(17, 59), settings), false)
  assert.equal(isIndomieRunPeriod(lagos(18, 0), settings), true)
  assert.equal(getNextAvailableIndomieRun(lagos(18, 0), settings)?.toISOString(), lagos(18, 30).toISOString())
})

test('server booking cutoff is enforced at the boundary regardless of browser time', () => {
  const run = lagos(18, 30)
  assert.equal(isRunStillBookable(run, lagos(18, 19, 59), settings), true)
  assert.equal(isRunStillBookable(run, lagos(18, 20), settings), false)
})

test('server schedule has no available run after the final booking cutoff', () => {
  assert.equal(getNextAvailableIndomieRun(lagos(20, 49), settings)?.toISOString(), lagos(21, 0).toISOString())
  assert.equal(getNextAvailableIndomieRun(lagos(20, 50), settings), null)
})

test('training creates a synthetic run outside the live evening schedule while preserving cutoff and interval', () => {
  const run = getNextTrainingIndomieRun(lagos(13, 3), settings)
  assert.ok(run.getTime() >= lagos(13, 13).getTime())
  assert.equal(run.getTime() % (settings.runIntervalMinutes * 60_000), 0)
})
