type VersionedOrder = { _id: string; updatedAt?: string; cafeOptionsVersion?: number }

// HTTP snapshots and socket patches share the database timestamp. Never rank
// statuses: a cafe may legitimately return from unavailable to checking.
export function mergeOrderUpdate<T extends VersionedOrder>(current: T | null, incoming: T): T
export function mergeOrderUpdate<T extends VersionedOrder>(current: T, incoming: Partial<T> & { _id: string }): T
export function mergeOrderUpdate<T extends VersionedOrder>(current: T | null, incoming: Partial<T> & { _id: string }): T {
  if (!current || current._id !== incoming._id) return incoming as T
  const previousTime = Date.parse(current.updatedAt || '')
  const nextTime = Date.parse(incoming.updatedAt || '')
  if (Number.isFinite(previousTime) && (!Number.isFinite(nextTime) || nextTime < previousTime)) return current
  if (nextTime === previousTime) {
    if ((incoming.cafeOptionsVersion ?? 0) < (current.cafeOptionsVersion ?? 0)) return current
    if ((incoming.cafeOptionsVersion ?? 0) === (current.cafeOptionsVersion ?? 0)) {
      // Fill fields omitted by a same-version socket patch without reverting it.
      return { ...incoming, ...current }
    }
  }
  return { ...current, ...incoming }
}
