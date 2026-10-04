export type TaskerGenderRestriction = 'male' | 'female' | 'any'

// The booking form currently accepts free text. Keep explicit destination aliases
// here until delivery locations have their own persisted IDs.
export const DELIVERY_DESTINATIONS: ReadonlyArray<{
  id?: string
  requiresRoomNumber?: boolean
  aliases: readonly string[]
  restriction: TaskerGenderRestriction
}> = [
  { id: 'girls-hostel', requiresRoomNumber: true, aliases: ['girls hostel', 'female hostel'], restriction: 'female' },
  { id: 'amnesty', requiresRoomNumber: true, aliases: ['amnesty', 'amnesty hostel', 'boys hostel', 'male hostel'], restriction: 'male' },
  { aliases: ['library', 'plt', 'nddc auditorium', 'staff quarters', 'lecturers block', 'bursary'], restriction: 'any' },
]

export function classifyDeliveryLocation(location?: string | null): TaskerGenderRestriction | undefined {
  const normalized = String(location || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const matches = DELIVERY_DESTINATIONS.filter(destination => destination.aliases.some(alias =>
    ` ${normalized} `.includes(` ${alias} `)
  ))
  const restricted = new Set(matches.map(destination => destination.restriction).filter(value => value !== 'any'))
  if (restricted.size > 1) return undefined
  return restricted.size === 1 ? [...restricted][0] : matches.length ? 'any' : undefined
}

export function getOrderRestriction(order: { location?: string | null; taskerGenderRestriction?: TaskerGenderRestriction | null }) {
  // Reclassify known destinations so stale/imported metadata cannot weaken them.
  return classifyDeliveryLocation(order.location) ?? order.taskerGenderRestriction ?? undefined
}

export function canTaskerDeliver(order: { location?: string | null; taskerGenderRestriction?: TaskerGenderRestriction | null }, gender?: string | null) {
  const restriction = getOrderRestriction(order)
  return restriction === 'any' || ((restriction === 'male' || restriction === 'female') && restriction === gender)
}

export function getRoomDestination(location?: string | null) {
  const restriction = classifyDeliveryLocation(location)
  return DELIVERY_DESTINATIONS.find(item => item.requiresRoomNumber && item.restriction === restriction)
}
export function normalizeRoomNumber(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('Enter a valid room number.')
  const room = value.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!room) return undefined
  if (room.length > 40 || /[\x00-\x1f\x7f]/.test(room)) throw new Error('Enter a room number of at most 40 characters.')
  return room
}
export function validateDeliveryRoom(location: string, value: unknown) {
  const room = normalizeRoomNumber(value)
  if (getRoomDestination(location)?.requiresRoomNumber && !room) throw new Error('Enter your room number for this hostel.')
  return room
}
