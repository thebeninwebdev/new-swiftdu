export interface MutationTicket {
  key: string
  generation: number
}

/**
 * Small client-side mutation coordinator. It deliberately stores no domain
 * state: components keep their own snapshots while this class prevents
 * duplicate submissions and stale responses from winning.
 */
export class ClientMutationCoordinator {
  private generations = new Map<string, number>()
  private active = new Map<string, number>()

  begin(key: string, options?: { replace?: boolean }): MutationTicket | null {
    if (this.active.has(key) && !options?.replace) return null
    const generation = (this.generations.get(key) || 0) + 1
    this.generations.set(key, generation)
    this.active.set(key, generation)
    return { key, generation }
  }

  isCurrent(ticket: MutationTicket) {
    return this.generations.get(ticket.key) === ticket.generation
  }

  isPending(key: string) {
    return this.active.has(key)
  }

  finish(ticket: MutationTicket) {
    if (this.active.get(ticket.key) === ticket.generation) {
      this.active.delete(ticket.key)
    }
  }

  invalidate(key: string) {
    this.generations.set(key, (this.generations.get(key) || 0) + 1)
    this.active.delete(key)
  }
}

export function mergeUniqueById<T extends { _id: string }>(previous: T[], incoming: T[]) {
  const byId = new Map(previous.map((item) => [item._id, item]))
  for (const item of incoming) byId.set(item._id, item)
  return [...byId.values()]
}
