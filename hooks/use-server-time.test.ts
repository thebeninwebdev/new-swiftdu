import assert from 'node:assert/strict'
import test from 'node:test'
import { getServerTimeOffset } from './use-server-time'

test('corrects a device clock two hours behind using the response midpoint', () => {
  const localMidpoint = Date.parse('2026-10-18T16:00:00.000Z')
  const serverTime = new Date(localMidpoint + 2 * 60 * 60_000).toISOString()
  assert.equal(getServerTimeOffset({ serverNow: serverTime, requestStartedAt: localMidpoint - 100, requestFinishedAt: localMidpoint + 100 }), 2 * 60 * 60_000)
})

test('corrects a device clock five hours ahead using the response midpoint', () => {
  const localMidpoint = Date.parse('2026-10-18T23:00:00.000Z')
  const serverTime = new Date(localMidpoint - 5 * 60 * 60_000).toISOString()
  assert.equal(getServerTimeOffset({ serverNow: serverTime, requestStartedAt: localMidpoint - 250, requestFinishedAt: localMidpoint + 250 }), -5 * 60 * 60_000)
})

test('rejects absent or invalid server timestamps rather than trusting device time', () => {
  assert.equal(getServerTimeOffset({ serverNow: undefined, requestStartedAt: 1, requestFinishedAt: 2 }), null)
  assert.equal(getServerTimeOffset({ serverNow: 'not-a-date', requestStartedAt: 1, requestFinishedAt: 2 }), null)
})
