
export interface DeliveryCoordinates {
  latitude: number
  longitude: number
  accuracy?: number
  capturedAt: Date
}
export function validateDeliveryCoordinates(value: unknown, now = new Date()): DeliveryCoordinates | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid delivery coordinates.')
  const data = value as Record<string, unknown>
  const validNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  if (!validNumber(data.latitude) || data.latitude < -90 || data.latitude > 90 ||
      !validNumber(data.longitude) || data.longitude < -180 || data.longitude > 180 ||
      (data.accuracy !== undefined && (!validNumber(data.accuracy) || data.accuracy < 0))) {
    throw new Error('Invalid delivery coordinates.')
  }
  if (typeof data.capturedAt !== 'string') throw new Error('Invalid location capture time.')
  const capturedAt = new Date(data.capturedAt)
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt.getTime() > now.getTime() + 60000 ||
      capturedAt.getTime() < now.getTime() - 10 * 60000) throw new Error('Location is stale. Please retry location capture.')
  return { latitude: data.latitude, longitude: data.longitude, ...(data.accuracy !== undefined ? { accuracy: data.accuracy as number } : {}), capturedAt }
}
type CapturedPosition = { latitude: number; longitude: number; accuracy: number; capturedAt: string }

function requestPosition(geolocation: Pick<Geolocation, 'getCurrentPosition'>, options: PositionOptions) {
  return new Promise<CapturedPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      }),
      reject,
      options,
    )
  })
}

function locationError(error: GeolocationPositionError) {
  return new Error(error.code === 1 ? 'Location permission was denied.' : error.code === 3 ? 'Location capture timed out. Please try again from an area with better signal.' : 'Your location is temporarily unavailable.')
}

/**
 * Ask for precise GPS first. Some phones cannot obtain that fix promptly indoors,
 * so a timeout falls back to the device's normal location provider instead of
 * making location setup fail outright.
 */
export async function captureDeliveryPosition(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined = typeof navigator !== 'undefined' ? navigator.geolocation : undefined) {
  if (!geolocation) throw new Error('This browser does not support location capture.')
  try {
    return await requestPosition(geolocation, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 })
  } catch (error) {
    const positionError = error as GeolocationPositionError
    if (positionError.code !== 3) throw locationError(positionError)
    try {
      return await requestPosition(geolocation, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 })
    } catch (fallbackError) {
      throw locationError(fallbackError as GeolocationPositionError)
    }
  }
}
