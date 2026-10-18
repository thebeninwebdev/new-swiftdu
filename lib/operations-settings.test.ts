import assert from 'node:assert/strict'
import test from 'node:test'
import { getIndomieServiceMode, getNextOpeningTime, isWithinOperatingHours } from './operations-settings'
import { getNextAvailableIndomieRun } from './indomie-runs'
import { DEFAULT_INDOMIE_BATCH_SETTINGS } from './indomie-batch-settings'

const operations = { openMinute: 7 * 60, closeMinute: 22 * 60 }
const batching = DEFAULT_INDOMIE_BATCH_SETTINGS
const at = (hour: number, minute: number, day = 1) => new Date(Date.UTC(2026, 0, day, hour - 1, minute))

test('SwiftDU daily opening and closing boundaries use Lagos time', () => {
  assert.equal(isWithinOperatingHours(at(6, 59), operations), false)
  assert.equal(isWithinOperatingHours(at(7, 0), operations), true)
  assert.equal(isWithinOperatingHours(at(21, 59), operations), true)
  assert.equal(isWithinOperatingHours(at(22, 0), operations), false)
})

test('Indomie follows normal, batching, then closed lifecycle', () => {
  assert.equal(getIndomieServiceMode({ now: at(10, 0), operationsSettings: operations, batchingSettings: batching }), 'normal')
  assert.equal(getIndomieServiceMode({ now: at(17, 59), operationsSettings: operations, batchingSettings: batching }), 'normal')
  assert.equal(getIndomieServiceMode({ now: at(18, 0), operationsSettings: operations, batchingSettings: batching }), 'batching')
  assert.equal(getIndomieServiceMode({ now: at(19, 30), operationsSettings: operations, batchingSettings: batching }), 'batching')
  assert.equal(getIndomieServiceMode({ now: at(20, 49), operationsSettings: operations, batchingSettings: batching }), 'batching')
  assert.equal(getIndomieServiceMode({ now: at(20, 50), operationsSettings: operations, batchingSettings: batching }), 'closed')
  assert.equal(getIndomieServiceMode({ now: at(21, 0), operationsSettings: operations, batchingSettings: batching }), 'closed')
  assert.equal(getIndomieServiceMode({ now: at(21, 30), operationsSettings: operations, batchingSettings: batching }), 'closed')
  assert.equal(getIndomieServiceMode({ now: at(7, 0, 2), operationsSettings: operations, batchingSettings: batching }), 'normal')
})

test('final 9 PM run obeys cutoff and no 9:30 PM run is generated', () => {
  assert.equal(getNextAvailableIndomieRun(at(20, 49), batching)?.getTime(), at(21, 0).getTime())
  assert.equal(getNextAvailableIndomieRun(at(20, 50), batching), null)
  assert.equal(getNextAvailableIndomieRun(at(21, 0), batching), null)
})

test('next opening is today before opening and tomorrow after closing', () => {
  assert.equal(getNextOpeningTime(at(6, 59), operations).getTime(), at(7, 0).getTime())
  assert.equal(getNextOpeningTime(at(22, 10), operations).getTime(), at(7, 0, 2).getTime())
})
