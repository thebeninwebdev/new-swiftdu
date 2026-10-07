export const CAMPUS_LOCATION_TYPES = ['building', 'hostel', 'lecture_theatre', 'room', 'entrance', 'shop', 'cafeteria', 'pickup_point', 'landmark', 'other'] as const
export type CampusLocationType = (typeof CAMPUS_LOCATION_TYPES)[number]

export interface CampusCoordinates { latitude: number; longitude: number; accuracy?: number; capturedAt: Date }

export function normalizeLocationName(value: unknown) {
  if (typeof value !== 'string') throw new Error('Location name is required.')
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 120) throw new Error('Location name must be between 1 and 120 characters.')
  return name
}

export function normalizeLocationKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function validateCampusCoordinates(value: unknown, now = new Date()): CampusCoordinates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Confirm a current location before saving.')
  const point = value as Record<string, unknown>
  const numeric = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number)
  if (!numeric(point.latitude) || point.latitude < -90 || point.latitude > 90 || !numeric(point.longitude) || point.longitude < -180 || point.longitude > 180 || (point.accuracy !== undefined && (!numeric(point.accuracy) || point.accuracy < 0))) throw new Error('Invalid location coordinates.')
  if (typeof point.capturedAt !== 'string') throw new Error('Invalid location capture time.')
  const capturedAt = new Date(point.capturedAt)
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt.getTime() > now.getTime() + 60_000 || capturedAt.getTime() < now.getTime() - 10 * 60_000) throw new Error('Location is stale. Please recapture your current location.')
  return { latitude: point.latitude, longitude: point.longitude, ...(point.accuracy === undefined ? {} : { accuracy: point.accuracy }), capturedAt }
}

export function validateCampusLocationInput(value: unknown, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid location details.')
  const data = value as Record<string, unknown>
  const name = normalizeLocationName(data.name)
  const type = data.type
  if (typeof type !== 'string' || !CAMPUS_LOCATION_TYPES.includes(type as CampusLocationType)) throw new Error('Invalid location type.')
  return { name, normalizedName: normalizeLocationKey(name), type: type as CampusLocationType, coordinates: validateCampusCoordinates(data.coordinates, now) }
}
