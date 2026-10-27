'use client'

import { WifiOff } from 'lucide-react'
import { useNetworkState } from '@/hooks/use-network-state'

export function ConnectionNotice({ refreshFailed = false }: { refreshFailed?: boolean }) {
  const { online } = useNetworkState()
  if (online && !refreshFailed) return null
  return <div role="status" className="mx-auto mb-4 flex max-w-xl items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" /><span>{online ? 'Connection is slow. Showing the latest saved information while we retry.' : "Connection lost. Showing the latest saved information. We'll refresh when you're back online."}</span></div>
}
