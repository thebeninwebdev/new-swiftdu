'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskerUser {
  _id: string
  name: string
  email: string
}

interface Tasker {
  _id: string
  phone: string
  location: string
  studentId: string
  profileImage?: string
  isVerified: boolean
  isRejected: boolean
  isPremium: boolean
  isSettlementSuspended?: boolean
  rating: number
  completedTasks: number
  bankDetails: {
    bankName: string
    accountNumber: string
    accountName: string
  }
  createdAt: string
  user: TaskerUser | null
}

type StatusFilter = 'pending' | 'verified' | 'rejected'

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Auth check ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) { router.push('/login'); return }
        // if (data.user.role !== 'admin') { router.push('/'); return }
        setAdmin(data.user)
      } catch {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // ── Fetch taskers ──────────────────────────────────────────────────────────

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

  // ── Approve / Reject ───────────────────────────────────────────────────────

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

      toast.success(
        action === 'approve'
          ? 'Tasker approved'
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

  const handlePremiumToggle = async (taskerId: string, nextPremium: boolean) => {
    setActionLoading(`${taskerId}-${nextPremium ? 'premium-on' : 'premium-off'}`)
    try {
      const res = await fetch(`/api/admin/taskers/${taskerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPremium: nextPremium }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Could not update premium access'); return }

      toast.success(nextPremium ? 'Premium access enabled' : 'Premium access removed')
      setTaskers((prev) =>
        prev.map((tasker) =>
          tasker._id === taskerId ? { ...tasker, isPremium: nextPremium } : tasker
        )
      )
    } catch {
      toast.error('Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Counts per filter ──────────────────────────────────────────────────────

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

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={s.loadingScreen}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Loading admin panel…</p>
      </div>
    )
  }

  if (!admin) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      <div style={s.bgBlob} />

      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <span style={s.badge}>Admin Panel</span>
            <h1 style={s.title}>Tasker Applications</h1>
            <p style={s.subtitle}>
              Review applications and control which verified taskers receive new-task email alerts.
            </p>
          </div>
          <div style={s.adminChip}>
            <div style={s.adminDot} />
            <span>{admin.name?.split(' ')[0]}</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={s.tabRow}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              style={{
                ...s.tab,
                ...(activeFilter === key ? s.tabActive : {}),
              }}
              onClick={() => setActiveFilter(key)}
            >
              {label}
              {activeFilter === key && taskers.length > 0 && (
                <span style={s.tabCount}>{taskers.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isFetching ? (
          <div style={s.fetchingRow}>
            <div style={s.spinnerSm} />
            <span style={s.fetchingText}>Loading…</span>
          </div>
        ) : taskers.length === 0 ? (
          <div style={s.emptyState}>
            <span style={s.emptyIcon}>
              {activeFilter === 'pending' ? '📋' : activeFilter === 'verified' ? '✅' : '🚫'}
            </span>
            <p style={s.emptyTitle}>No {activeFilter} taskers</p>
            <p style={s.emptyBody}>
              {activeFilter === 'pending'
                ? 'All caught up — no applications waiting for review.'
                : `No taskers have been ${activeFilter} yet.`}
            </p>
          </div>
        ) : (
          <div style={s.list}>
            {taskers.map((tasker) => {
              const isExpanded = expandedId === tasker._id
              const isActing = actionLoading?.startsWith(tasker._id)

              return (
                <div key={tasker._id} style={s.card}>

                  {/* Card header row */}
                  <div style={s.cardTop}>
                    {/* Avatar */}
                    <div style={s.avatarWrap}>
                      {tasker.profileImage ? (
                        <img src={tasker.profileImage} alt="avatar" style={s.avatar} />
                      ) : (
                        <div style={s.avatarFallback}>
                          {tasker.user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={s.cardInfo}>
                      <div style={s.cardName}>
                        {tasker.user?.name ?? 'Unknown User'}
                      </div>
                      <div style={s.cardMeta}>
                        {tasker.user?.email ?? '—'}
                        <span style={s.dot}>·</span>
                        {tasker.phone}
                        <span style={s.dot}>·</span>
                        {tasker.location}
                      </div>
                      <div style={s.cardDate}>
                        Applied {new Date(tasker.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Status pill */}
                    <div style={s.statusWrap}>
                      <div style={{
                        ...s.statusPill,
                        ...(tasker.isVerified
                          ? s.pillVerified
                          : tasker.isRejected
                          ? s.pillRejected
                          : s.pillPending),
                      }}>
                        {tasker.isVerified ? 'Approved' : tasker.isRejected ? 'Rejected' : 'Pending'}
                      </div>
                      {tasker.isPremium ? (
                        <div style={{ ...s.statusPill, ...s.pillPremium }}>
                          Premium
                        </div>
                      ) : null}
                      {tasker.isSettlementSuspended ? (
                        <div style={{ ...s.statusPill, ...s.pillRejected }}>
                          Suspended
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    style={s.expandBtn}
                    onClick={() => setExpandedId(isExpanded ? null : tasker._id)}
                  >
                    {isExpanded ? 'Hide details ↑' : 'View details ↓'}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={s.details}>
                      <div style={s.detailsGrid}>
                        <DetailRow label="Student ID" value={tasker.studentId} />
                        <DetailRow label="Bank" value={tasker.bankDetails.bankName} />
                        <DetailRow label="Account Number" value={tasker.bankDetails.accountNumber} />
                        <DetailRow label="Account Name" value={tasker.bankDetails.accountName} />
                        <DetailRow label="Completed Tasks" value={String(tasker.completedTasks)} />
                        <DetailRow label="Rating" value={tasker.rating > 0 ? `${tasker.rating}/5` : 'Not yet rated'} />
                        <DetailRow label="Premium Email Alerts" value={tasker.isPremium ? 'Enabled' : 'Disabled'} />
                        <DetailRow label="Tasker Suspension" value={tasker.isSettlementSuspended ? 'Suspended' : 'Active'} />
                      </div>
                    </div>
                  )}

                  {/* Actions — only show for pending */}
                  {tasker.isVerified && (
                    <div style={s.actions}>
                      <button
                        style={{
                          ...s.trustBtn,
                          ...(tasker.isPremium ? s.trustBtnActive : {}),
                          ...(isActing ? s.btnDisabled : {}),
                        }}
                        disabled={!!isActing}
                        onClick={() => handlePremiumToggle(tasker._id, !tasker.isPremium)}
                      >
                        {actionLoading === `${tasker._id}-${tasker.isPremium ? 'premium-off' : 'premium-on'}`
                          ? tasker.isPremium
                            ? 'Removing...'
                            : 'Saving...'
                          : tasker.isPremium
                            ? 'Remove Premium Access'
                            : 'Make Premium'}
                      </button>
                    </div>
                  )}

                  {!tasker.isVerified && !tasker.isRejected && (
                    <div style={s.actions}>
                      <button
                        style={{
                          ...s.rejectBtn,
                          ...(isActing ? s.btnDisabled : {}),
                        }}
                        disabled={!!isActing}
                        onClick={() => handleAction(tasker._id, 'reject')}
                      >
                        {actionLoading === `${tasker._id}-reject` ? 'Rejecting…' : 'Reject'}
                      </button>
                      <button
                        style={{
                          ...s.approveBtn,
                          ...(isActing ? s.btnDisabled : {}),
                        }}
                        disabled={!!isActing}
                        onClick={() => handleAction(tasker._id, 'approve')}
                      >
                        {actionLoading === `${tasker._id}-approve` ? 'Approving…' : 'Approve'}
                      </button>
                    </div>
                  )}

                  {/* Re-action for already reviewed */}
                  {(tasker.isVerified || tasker.isRejected) && (
                    <div style={s.actions}>
                      {tasker.isVerified && (
                        <button
                          style={{
                            ...s.rejectBtn,
                            ...(tasker.isSettlementSuspended ? s.activateBtn : {}),
                            ...(isActing ? s.btnDisabled : {}),
                          }}
                          disabled={!!isActing}
                          onClick={() => handleAction(tasker._id, tasker.isSettlementSuspended ? 'activate' : 'suspend')}
                        >
                          {actionLoading === `${tasker._id}-${tasker.isSettlementSuspended ? 'activate' : 'suspend'}`
                            ? 'Saving...'
                            : tasker.isSettlementSuspended
                              ? 'Restore Tasker'
                              : 'Suspend Tasker'}
                        </button>
                      )}
                      {tasker.isVerified && (
                        <button
                          style={{ ...s.rejectBtn, ...(isActing ? s.btnDisabled : {}) }}
                          disabled={!!isActing}
                          onClick={() => handleAction(tasker._id, 'reject')}
                        >
                          {actionLoading === `${tasker._id}-reject` ? 'Revoking…' : 'Revoke Approval'}
                        </button>
                      )}
                      {tasker.isRejected && (
                        <button
                          style={{ ...s.approveBtn, ...(isActing ? s.btnDisabled : {}) }}
                          disabled={!!isActing}
                          onClick={() => handleAction(tasker._id, 'approve')}
                        >
                          {actionLoading === `${tasker._id}-approve` ? 'Approving…' : 'Approve Instead'}
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Detail row sub-component ─────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      <span style={s.detailValue}>{value}</span>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const COLOR = {
  bg: '#f5f4f0',
  surface: '#ffffff',
  border: '#e2dfd8',
  accent: '#2563eb',
  accentDim: 'rgba(37,99,235,0.08)',
  accentText: '#1d4ed8',
  text: '#111110',
  muted: '#6b7280',
  mutedLight: '#9ca3af',
  error: '#dc2626',
  errorDim: 'rgba(220,38,38,0.08)',
  errorBorder: 'rgba(220,38,38,0.2)',
  success: '#16a34a',
  successDim: 'rgba(22,163,74,0.08)',
  successBorder: 'rgba(22,163,74,0.2)',
  pendingDim: 'rgba(217,119,6,0.08)',
  pendingBorder: 'rgba(217,119,6,0.2)',
  pendingText: '#92400e',
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: COLOR.bg,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    color: COLOR.text,
    position: 'relative',
    overflowX: 'hidden',
    padding: '32px 14px 72px',
  },
  bgBlob: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `radial-gradient(ellipse 70% 40% at 60% 0%, rgba(37,99,235,0.05) 0%, transparent 65%)`,
    pointerEvents: 'none',
    zIndex: 0,
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  // Header
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: COLOR.accentText,
    background: COLOR.accentDim,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(37,99,235,0.22)',
    borderRadius: 4,
    padding: '3px 10px',
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    margin: '0 0 6px',
    color: COLOR.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLOR.muted,
    margin: 0,
  },
  adminChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.muted,
    background: COLOR.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 99,
    padding: '6px 14px',
    whiteSpace: 'nowrap' as const,
    maxWidth: '100%',
  },
  adminDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: COLOR.success,
  },
  // Filter tabs
  tabRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    background: COLOR.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 10,
    padding: 4,
    width: '100%',
    overflowX: 'auto' as const,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 18px',
    fontSize: 13,
    fontWeight: 600,
    background: 'none',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 7,
    color: COLOR.muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  tabActive: {
    background: COLOR.accent,
    color: '#ffffff',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.25)',
    borderRadius: 99,
    padding: '1px 7px',
  },
  // Loading / fetching
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: COLOR.bg,
    gap: 16,
    fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    width: 32,
    height: 32,
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderTopColor: COLOR.accent,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  spinnerSm: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderTopColor: COLOR.accent,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 14,
    color: COLOR.muted,
    margin: 0,
  },
  fetchingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '32px 0',
  },
  fetchingText: {
    fontSize: 14,
    color: COLOR.muted,
  },
  // Empty state
  emptyState: {
    textAlign: 'center' as const,
    padding: '64px 24px',
    background: COLOR.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 16,
  },
  emptyIcon: { fontSize: 36, display: 'block', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: COLOR.text },
  emptyBody: { fontSize: 14, color: COLOR.muted, margin: 0 },
  // List
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  // Card
  card: {
    background: COLOR.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 14,
    padding: '18px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap' as const,
  },
  // Avatar
  avatarWrap: {
    flexShrink: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: COLOR.border,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: COLOR.accentDim,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'rgba(37,99,235,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: COLOR.accentText,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 700,
    color: COLOR.text,
    marginBottom: 3,
    lineHeight: 1.35,
  },
  cardMeta: {
    fontSize: 13,
    color: COLOR.muted,
    marginBottom: 3,
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    alignItems: 'center',
    lineHeight: 1.5,
  },
  dot: {
    color: COLOR.mutedLight,
    fontSize: 16,
    lineHeight: 1,
  },
  cardDate: {
    fontSize: 12,
    color: COLOR.mutedLight,
  },
  // Status pill
  statusPill: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    borderRadius: 99,
    padding: '3px 10px',
    whiteSpace: 'nowrap' as const,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  statusWrap: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    alignItems: 'center',
  },
  pillPending: {
    background: COLOR.pendingDim,
    borderColor: COLOR.pendingBorder,
    color: COLOR.pendingText,
  },
  pillVerified: {
    background: COLOR.successDim,
    borderColor: COLOR.successBorder,
    color: COLOR.success,
  },
  pillRejected: {
    background: COLOR.errorDim,
    borderColor: COLOR.errorBorder,
    color: COLOR.error,
  },
  pillPremium: {
    background: COLOR.accentDim,
    borderColor: 'rgba(37,99,235,0.22)',
    color: COLOR.accentText,
  },
  // Expand button
  expandBtn: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.accentText,
    background: 'none',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  // Details
  details: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopStyle: 'solid' as const,
    borderTopColor: COLOR.border,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    background: '#fafaf8',
    borderRadius: 8,
    padding: '10px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: COLOR.mutedLight,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.text,
  },
  // Actions
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
    justifyContent: 'flex-end',
    flexWrap: 'wrap' as const,
  },
  rejectBtn: {
    flex: '1 1 180px',
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 700,
    background: COLOR.errorDim,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.errorBorder,
    borderRadius: 8,
    color: COLOR.error,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    textAlign: 'center' as const,
  },
  approveBtn: {
    flex: '1 1 180px',
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 700,
    background: COLOR.accent,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    textAlign: 'center' as const,
  },
  activateBtn: {
    background: COLOR.successDim,
    borderColor: COLOR.successBorder,
    color: COLOR.success,
  },
  trustBtn: {
    flex: '1 1 220px',
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 700,
    background: 'rgba(22,163,74,0.08)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(22,163,74,0.2)',
    borderRadius: 8,
    color: COLOR.success,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    textAlign: 'center' as const,
  },
  trustBtnActive: {
    background: '#16a34a',
    color: '#ffffff',
    borderColor: '#16a34a',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}
