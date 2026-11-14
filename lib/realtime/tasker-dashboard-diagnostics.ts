export function getMissedRealtimeOrderIds(
  availableOrderIds: Iterable<string>,
  knownOrderIds: ReadonlySet<string>,
  realtimeReceivedOrderIds: ReadonlySet<string>,
  hasBaseline: boolean,
) {
  if (!hasBaseline) return []
  return [...availableOrderIds].filter(orderId =>
    !knownOrderIds.has(orderId) && !realtimeReceivedOrderIds.has(orderId)
  )
}

export function getTaskerDashboardPollInterval(socketHealthy: boolean) {
  return socketHealthy ? 60_000 : 30_000
}
