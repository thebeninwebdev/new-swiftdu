import assert from 'node:assert/strict'
import test from 'node:test'
import { formatNextOperationalOpening, formatOperationalTime, getCustomerOperationsState, isCustomerOrderingUnavailable } from './operations-display'

test('customer operations state prioritizes a global pause over schedule status', () => {
  assert.equal(getCustomerOperationsState({ enabled: false, open: false }), 'paused')
  assert.equal(getCustomerOperationsState({ enabled: true, open: false }), 'closed')
  assert.equal(getCustomerOperationsState({ enabled: true, open: true }), 'open')
})

test('training mode is never blocked by the customer live-operations gate', () => {
  assert.equal(isCustomerOrderingUnavailable({ enabled: false, open: false }, true), false)
  assert.equal(isCustomerOrderingUnavailable({ enabled: true, open: false }, true), false)
  assert.equal(isCustomerOrderingUnavailable({ enabled: false, open: false }, false), true)
  assert.equal(isCustomerOrderingUnavailable({ enabled: true, open: false }, false), true)
  assert.equal(isCustomerOrderingUnavailable({ enabled: true, open: true }, false), false)
})

test('operational times use a friendly 12-hour display', () => {
  assert.equal(formatOperationalTime('07:00'), '7:00 AM')
  assert.equal(formatOperationalTime('22:00'), '10:00 PM')
})

test('next opening is formatted in Lagos time rather than the device timezone', () => {
  const now = new Date('2026-01-01T22:10:00.000Z') // 11:10 PM in Lagos
  assert.equal(formatNextOperationalOpening('2026-01-02T06:00:00.000Z', '07:00', now), 'tomorrow at 7:00 AM')
})
