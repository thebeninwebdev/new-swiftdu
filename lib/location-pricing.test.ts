import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDistanceKm } from './location-pricing'
import { getPricingCoordinates } from './campus-location'

const parent = { parentLocationId: null, coordinates: { latitude: 5, longitude: 5, capturedAt: new Date() } }
const exact = { parentLocationId: 'child', coordinates: { latitude: 5.01, longitude: 5.01, capturedAt: new Date() } }

test('pricing coordinates always come from a parent location', () => {
  assert.equal(getPricingCoordinates(parent).latitude, 5)
  assert.throws(() => getPricingCoordinates(exact))
})

test('Haversine distance is deterministic for known coordinates', () => {
  assert.equal(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0)
  assert.ok(Math.abs(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111.195) < 0.01)
})
