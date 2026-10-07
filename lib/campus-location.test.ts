import assert from 'node:assert/strict'
import { test } from 'node:test'
import CampusLocation from '../models/campus-location'
import { normalizeLocationKey, validateCampusCoordinates, validateCampusLocationInput } from './campus-location'

const now = new Date('2026-10-07T12:00:00.000Z')
const point = { latitude: 5.123456, longitude: 5.654321, accuracy: 8, capturedAt: now.toISOString() }

test('campus coordinates validate ranges, numeric values, and fresh captures', () => {
  assert.equal(validateCampusCoordinates(point, now).latitude, point.latitude)
  for (const invalid of [{ ...point, latitude: 91 }, { ...point, longitude: -181 }, { ...point, accuracy: -1 }, { ...point, latitude: '5' }, { ...point, capturedAt: '2020-01-01T00:00:00.000Z' }]) assert.throws(() => validateCampusCoordinates(invalid, now))
})

test('parent and sublocation inputs normalize independent hierarchical identities', () => {
  const parent = validateCampusLocationInput({ name: ' Amnesty Hostel ', type: 'hostel', coordinates: point }, now)
  const child = validateCampusLocationInput({ name: ' b27 ', type: 'room', coordinates: point }, now)
  assert.equal(parent.name, 'Amnesty Hostel')
  assert.equal(child.normalizedName, 'b27')
  assert.equal(normalizeLocationKey(' PLT 8 '), 'plt-8')
  assert.throws(() => validateCampusLocationInput({ name: '', type: 'room', coordinates: point }, now))
  assert.throws(() => validateCampusLocationInput({ name: 'B27', type: 'not-a-type', coordinates: point }, now))
})

test('self-referencing schema indexes children and prevents duplicate normalized names per parent', () => {
  const indexes = CampusLocation.schema.indexes()
  assert.ok(indexes.some((entry: any) => entry[0].parentLocationId === 1 && entry[0].normalizedName === 1 && entry[1].unique))
  assert.ok(indexes.some((entry: any) => entry[0].parentLocationId === 1))
  assert.ok(indexes.some((entry: any) => entry[0].type === 1 && entry[0].active === 1))
  const firstParent = new CampusLocation({ name: 'B27', normalizedName: 'b27', parentLocationId: '507f1f77bcf86cd799439011', type: 'room', coordinates: validateCampusCoordinates(point, now), createdBy: 'admin' })
  const secondParent = new CampusLocation({ name: 'B27', normalizedName: 'b27', parentLocationId: '507f1f77bcf86cd799439012', type: 'room', coordinates: validateCampusCoordinates(point, now), createdBy: 'admin' })
  assert.notEqual(String(firstParent.parentLocationId), String(secondParent.parentLocationId))
})
