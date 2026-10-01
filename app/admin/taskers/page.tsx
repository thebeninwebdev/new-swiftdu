'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'


interface TaskerUser {
  _id: string
  name: string
  email: string
}

interface ApplicationCheck {
  status: 'valid' | 'warning' | 'invalid'
  label: string
  message: string
}

interface ApplicationReview {
  checks: ApplicationCheck[]
  status: 'valid' | 'warning' | 'invalid'
  attentionCount: number
}
interface Tasker {
  _id: string
  phone: string
  location: string
  studentId: string
  level?: string
  availability?: string[]
  motivation?: string
  motivationOther?: string
  profileImage?: string
  isVerified: boolean
  isRejected: boolean
  taskerMode: 'training' | 'live'
  isSettlementSuspended?: boolean
  rating: number
  completedTasks: number
  bankDetails: {
    bankName: string
    accountNumber: string
    accountName: string
  }
  createdAt: string
  applicationReview: ApplicationReview
  user: TaskerUser | null
}

type StatusFilter = 'pending' | 'verified' | 'rejected'


export default function AdminTaskersPage() {
  const router = useRouter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [admin, setAdmin] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [taskers, setTaskers] = useState<Tasker[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bankEdits, setBankEdits] = useState<Record<string, Tasker['bankDetails']>>({})


  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) { router.push('/auth'); return }
        // if (data.user.role !== 'admin') { router.push('/'); return }
        setAdmin(data.user)
      } catch {
        router.push('/auth')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])


  const fetchTaskers = useCallback(async (status: StatusFilter) => {
    setIsFetching(true)
    try {
      const res = await fetch(`/api/admin/taskers?status=${status}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to load taskers'); return }
      setTaskers(data.taskers)
    } catch {
      toast.error('Failed to load taskers')
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    if (admin) fetchTaskers(activeFilter)
  }, [admin, activeFilter, fetchTaskers])


  const handleAction = async (taskerId: string, action: 'approve' | 'reject' | 'suspend' | 'activate') => {
    setActionLoading(`${taskerId}-${action}`)
    try {
      const res = await fetch(`/api/admin/taskers/${taskerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Action failed'); return }

      if (action === 'approve' && data.onboardingEmailError) {
        toast.warning('Tasker approved, but the onboarding email could not be sent.')
      } else if (action === 'approve' && data.onboardingEmailSent) {
        toast.success('Tasker approved and onboarding email sent')
      }
      if (action === 'approve' && data.onboardingEmailReason === 'cooldown') {
        toast.info('An approval email was sent recently. Wait two minutes before resending.')
      }

      if (!(action === 'approve' && (data.onboardingEmailError || data.onboardingEmailSent))) toast.success(
        action === 'approve'
          ? data.accountLinked ? 'User account updated to tasker' : 'Tasker approved'
          : action === 'reject'
            ? 'Tasker rejected'
            : action === 'suspend'
              ? 'Tasker suspended'
              : 'Tasker restored'
      )
      setTaskers((prev) =>
        action === 'approve' || action === 'reject'
          ? prev.filter((t) => t._id !== taskerId)
          : prev.map((tasker) =>
              tasker._id === taskerId
                ? { ...tasker, isSettlementSuspended: action === 'suspend' }
                : tasker
            )
      )
      if ((action === 'approve' || action === 'reject') && expandedId === taskerId) {
        setExpandedId(null)
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBankDetailsUpdate = async (tasker: Tasker) => {
    const nextBankDetails = bankEdits[tasker._id] ?? tasker.bankDetails

    setActionLoading(`${tasker._id}-bank`)
    try {
      const res = await fetch(`/api/admin/taskers/${tasker._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankDetails: nextBankDetails }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Could not update bank details'); return }

      toast.success('Bank details updated')
      setTaskers((prev) =>
        prev.map((item) =>
          item._id === tasker._id ? { ...item, bankDetails: nextBankDetails } : item
        )
      )
    } catch {
      toast.error('Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  const handleModeChange = async (tasker: Tasker, taskerMode: 'training' | 'live') => {
    const label = taskerMode === 'live' ? 'Live Mode' : 'Training Mode'
    const confirmed = window.confirm(`Move ${tasker.user?.name ?? 'this tasker'} to ${label}?`)

    if (!confirmed) return

    setActionLoading(`${tasker._id}-mode`)
    try {
      const res = await fetch(`/api/admin/taskers/${tasker._id}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskerMode }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Could not update tasker mode'); return }

      toast.success(`Tasker moved to ${label}`)
      setTaskers((prev) =>
        prev.map((item) =>
          item._id === tasker._id ? { ...item, taskerMode } : item
        )
      )
    } catch {
      toast.error('Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }


  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'verified', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  useEffect(() => {
    if (typeof window === 'undefined') return

    const requestedStatus = new URLSearchParams(window.location.search).get('status')

    if (
      requestedStatus === 'pending' ||
      requestedStatus === 'verified' ||
      requestedStatus === 'rejected'
    ) {
      setActiveFilter(requestedStatus)
    }
  }, [])


  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500"><span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />Loading admin panel…</div>
  }

  if (!admin) return null

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasker applications</h1><p className="mt-1 text-sm text-slate-500 sm:text-base">Review applications, update bank details, and manage tasker access.</p></div>
          <span className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">{admin.name?.split(' ')[0]}</span>
        </header>

        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
          {FILTERS.map(({ key, label }) => <button key={key} type="button" onClick={() => setActiveFilter(key)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${activeFilter === key ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}>{label}{activeFilter === key && taskers.length > 0 && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{taskers.length}</span>}</button>)}
        </div>

        {isFetching ? <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />Loading taskers…</div> : taskers.length === 0 ? <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">✓</div><p className="mt-4 font-semibold">No {activeFilter} taskers</p><p className="mt-1 text-sm text-slate-500">{activeFilter === 'pending' ? 'All caught up — no applications waiting for review.' : `No taskers have been ${activeFilter} yet.`}</p></div> : <div className="space-y-4">
          {taskers.map((tasker) => {
            const isExpanded = expandedId === tasker._id
            const isActing = actionLoading?.startsWith(tasker._id)
            const reviewLabel = tasker.applicationReview.status === 'invalid' ? 'Incomplete application' : tasker.applicationReview.attentionCount ? tasker.applicationReview.attentionCount + ' things to verify' : 'Checks passed'
            const reviewTone = tasker.applicationReview.status === 'invalid' ? 'bg-rose-50 text-rose-700' : tasker.applicationReview.attentionCount ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            const statusTone = tasker.isVerified ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : tasker.isRejected ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
            return <article key={tasker._id} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-50 font-bold text-violet-700">{tasker.profileImage ? <img src={tasker.profileImage} alt="" className="h-full w-full object-cover" /> : (tasker.user?.name?.charAt(0)?.toUpperCase() ?? '?')}</div><div className="min-w-0"><h2 className="font-semibold text-slate-900">{tasker.user?.name ?? 'Unknown user'}</h2><p className="mt-1 break-words text-sm text-slate-500">{tasker.user?.email ?? 'No email'} <span className="hidden sm:inline">• {tasker.phone} • {tasker.location}</span></p><p className="mt-1 text-xs text-slate-400">Applied {new Date(tasker.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div></div>
                <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone}`}>{tasker.isVerified ? 'Approved' : tasker.isRejected ? 'Rejected' : 'Pending'}</span>{tasker.isSettlementSuspended && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">Suspended</span>}<span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">{tasker.taskerMode === 'training' ? 'Training' : 'Live'}</span></div>
              </div>
              <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${reviewTone}`}>{reviewLabel}</span><button type="button" onClick={() => setExpandedId(isExpanded ? null : tasker._id)} className="mt-5 min-h-11 rounded-xl px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">{isExpanded ? 'Hide details' : 'View details'}</button>
              {isExpanded && <div className="mt-4 border-t border-slate-100 pt-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><DetailRow label="Matric number" value={tasker.studentId} /><DetailRow label="Level" value={tasker.level || 'Not provided'} /><DetailRow label="Availability" value={tasker.availability?.join(', ') || 'Not provided'} /><DetailRow label="Why SwiftDU" value={tasker.motivation === 'Other' ? tasker.motivationOther || 'Other' : tasker.motivation || 'Not provided'} /><DetailRow label="Bank" value={tasker.bankDetails.bankName} /><DetailRow label="Account number" value={tasker.bankDetails.accountNumber ? `******${tasker.bankDetails.accountNumber.slice(-4)}` : 'Not submitted'} /><DetailRow label="Account name" value={tasker.bankDetails.accountName} /><DetailRow label="Completed tasks" value={String(tasker.completedTasks)} /><DetailRow label="Rating" value={tasker.rating > 0 ? `${tasker.rating}/5` : 'Not yet rated'} /></div>
                <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">Application summary</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet-700">Review assistant</p><div className="mt-3 space-y-2">{tasker.applicationReview.checks.map((check) => <div key={check.label} className="rounded-xl bg-white p-3"><p className="text-sm font-semibold text-slate-900">{check.label}</p><p className="mt-1 text-sm text-slate-600">{check.message}</p></div>)}</div></section><div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4"><input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={(bankEdits[tasker._id] ?? tasker.bankDetails).bankName} onChange={(event) => setBankEdits((previous) => ({ ...previous, [tasker._id]: { ...(previous[tasker._id] ?? tasker.bankDetails), bankName: event.target.value } }))} placeholder="Bank name" /><input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={(bankEdits[tasker._id] ?? tasker.bankDetails).accountNumber} onChange={(event) => setBankEdits((previous) => ({ ...previous, [tasker._id]: { ...(previous[tasker._id] ?? tasker.bankDetails), accountNumber: event.target.value.replace(/\D/g, '').slice(0, 10) } }))} placeholder="Account number" /><input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={(bankEdits[tasker._id] ?? tasker.bankDetails).accountName} onChange={(event) => setBankEdits((previous) => ({ ...previous, [tasker._id]: { ...(previous[tasker._id] ?? tasker.bankDetails), accountName: event.target.value } }))} placeholder="Account name" /><button type="button" className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50" disabled={actionLoading === `${tasker._id}-bank`} onClick={() => handleBankDetailsUpdate(tasker)}>{actionLoading === `${tasker._id}-bank` ? 'Saving…' : 'Save bank details'}</button></div></div>}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">{!tasker.isVerified && !tasker.isRejected && <><button type="button" disabled={!!isActing} onClick={() => handleAction(tasker._id, 'reject')} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 disabled:opacity-50">{actionLoading === `${tasker._id}-reject` ? 'Rejecting…' : 'Reject'}</button><button type="button" disabled={!!isActing} onClick={() => handleAction(tasker._id, 'approve')} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{actionLoading === `${tasker._id}-approve` ? 'Approving…' : 'Approve'}</button></>}{tasker.isVerified && <><button type="button" disabled={!!isActing} onClick={() => handleAction(tasker._id, 'approve')} className="min-h-11 rounded-xl border border-violet-200 px-4 text-sm font-semibold text-violet-700 disabled:opacity-50">Resend onboarding email</button><button type="button" disabled={!!isActing} onClick={() => handleModeChange(tasker, tasker.taskerMode === 'training' ? 'live' : 'training')} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">{tasker.taskerMode === 'training' ? 'Move to live mode' : 'Move to training mode'}</button><button type="button" disabled={!!isActing} onClick={() => handleAction(tasker._id, tasker.isSettlementSuspended ? 'activate' : 'suspend')} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 disabled:opacity-50">{tasker.isSettlementSuspended ? 'Restore tasker' : 'Suspend settlement'}</button><button type="button" disabled={!!isActing} onClick={() => handleAction(tasker._id, 'reject')} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 disabled:opacity-50">Revoke approval</button></>}{tasker.isRejected && <button type="button" disabled={!!isActing} onClick={() => handleAction(tasker._id, 'approve')} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Approve instead</button>}</div>
              </div></article>
          })}
        </div>}
      </div>
    </main>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>
}
