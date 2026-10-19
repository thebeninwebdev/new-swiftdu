import type { CampusCoordinates } from '@/lib/campus-location'

/** Straight-line server-side distance used when a real pickup/origin coordinate is available. */
export function calculateDistanceKm(origin: Pick<CampusCoordinates, 'latitude' | 'longitude'>, destination: Pick<CampusCoordinates, 'latitude' | 'longitude'>) {
  const radians = (value: number) => value * Math.PI / 180
  const earthKm = 6371
  const lat = radians(destination.latitude - origin.latitude)
  const lng = radians(destination.longitude - origin.longitude)
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(lng / 2) ** 2
  return 2 * earthKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
