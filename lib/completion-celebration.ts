type CompletionTiming = {
  status?: string
  completionTimerStartedAt?: string | Date | null
  completedAt?: string | Date | null
  completionWindowMinutes?: number | null
  customerReceiptConfirmed?: boolean
  prematureCompletionReported?: boolean
}

export function getCompletionRecognition(order: CompletionTiming) {
  const timestamp = (value: string | Date | null | undefined) =>
    value instanceof Date ? value.getTime() : typeof value === 'string' && value.trim() ? Date.parse(value) : NaN
  const start = timestamp(order.completionTimerStartedAt)
  const finish = timestamp(order.completedAt)
  const allowedDurationMs = typeof order.completionWindowMinutes === 'number' ? order.completionWindowMinutes * 60_000 : NaN
  const elapsedMs = finish - start
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(allowedDurationMs) || allowedDurationMs <= 0) {
    return { eligible: false, elapsedMs: null, allowedDurationMs: null }
  }
  return {
    eligible: order.status === 'completed' && !order.prematureCompletionReported && order.customerReceiptConfirmed !== false && elapsedMs * 3 < allowedDurationMs * 2,
    elapsedMs,
    allowedDurationMs,
  }
}

export function formatCompletionDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000)
  const seconds = (ms % 60_000) / 1000
  // Keep subsecond precision at the strict boundary rather than rounding up.
  return [minutes ? `${minutes} min` : '', seconds || !minutes ? `${Number(seconds.toFixed(3))} sec` : ''].filter(Boolean).join(' ')
}

const celebrated = new Set<string>()

export function claimCompletionCelebration(taskerId: string, orderId: string, storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const key = `swiftdu:completion:${JSON.stringify([taskerId, orderId])}`
  if (celebrated.has(key)) return false
  celebrated.add(key)
  try {
    if (storage?.getItem(key)) return false
    storage?.setItem(key, '1')
  } catch { /* Memory still deduplicates when storage is unavailable. */ }
  return true
}
