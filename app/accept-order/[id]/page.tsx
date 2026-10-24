'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

function dashboardNotice(notice: string) {
  return `/tasker-dashboard?notice=${encodeURIComponent(notice)}`
}

export default function AcceptOrderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const attempted = useRef(false)
  const orderId = String(params?.id || '')

  useEffect(() => {
    if (isPending || attempted.current) return

    const acceptPath = `/accept-order/${encodeURIComponent(orderId)}`
    if (!session?.user?.id) {
      attempted.current = true
      router.replace(`/auth?next=${encodeURIComponent(acceptPath)}`)
      return
    }

    if (!orderId) {
      attempted.current = true
      router.replace(dashboardNotice('not-found'))
      return
    }

    attempted.current = true
    void (async () => {
      try {
        const response = await fetch('/api/errands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
        const payload = await response.json().catch(() => ({})) as { error?: string }

        if (response.ok) {
          router.replace(`/tasker-dashboard/${encodeURIComponent(orderId)}`)
          return
        }

        if (response.status === 401) {
          router.replace(`/auth?next=${encodeURIComponent(acceptPath)}`)
          return
        }

        if (response.status === 404) {
          router.replace(dashboardNotice('not-found'))
          return
        }

        if (response.status === 409) {
          router.replace(dashboardNotice(payload.error?.toLowerCase().includes('already') ? 'already-accepted' : 'not-available'))
          return
        }

        if (response.status === 403) {
          router.replace(dashboardNotice(payload.error?.toLowerCase().includes('check in') ? 'not-checked-in' : 'not-eligible'))
          return
        }

        router.replace(dashboardNotice(response.status === 503 ? 'operations-unavailable' : 'not-available'))
      } catch {
        router.replace(dashboardNotice('not-available'))
      }
    })()
  }, [isPending, orderId, router, session?.user?.id])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" aria-hidden="true" />
        Accepting order...
      </div>
    </main>
  )
}
