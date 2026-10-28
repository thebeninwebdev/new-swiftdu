export type RealtimeIdentity = { userId: string; taskerId?: string; taskerMode?: 'training' | 'live' }

/** Server-derived, subscribe-only capabilities; browser channel names are never trusted. */
export function getRealtimeCapabilities(identity: RealtimeIdentity) {
  const capability: Record<string, string[]> = { [`user:${identity.userId}`]: ['subscribe'] }
  if (identity.taskerId) {
    capability[`tasker:${identity.taskerId}`] = ['subscribe']
    capability[identity.taskerMode === 'training' ? 'tasks:training' : 'tasks:live'] = ['subscribe']
  }
  return capability
}
export function getRealtimeChannels(identity: RealtimeIdentity) { return Object.keys(getRealtimeCapabilities(identity)) }
