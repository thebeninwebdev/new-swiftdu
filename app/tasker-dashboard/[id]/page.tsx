'use client'

import React, { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter, useParams } from 'next/navigation'

interface ErrandDetail {
  taskerFee: number
  platformFee: number
  commission: number
  totalAmount: number
  _id: string
  userId: string
  taskType: string
  description: string
  amount: number
  deadlineValue: number
  deadlineUnit: string
  location: string
  store?: string
  packaging?: string
  status: string
  taskerId?: string
  taskerName?: string
  acceptedAt?: string
  createdAt: string
}

interface UserInfo {
  name: string
  email: string
  phone: string
  location: string
}

const taskTypeIcons: Record<string, string> = {
  restaurant: '🍽️',
  printing: '🖨️',
  shopping: '🛍️',
  others: '📦',
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  shopping: 'Shopping',
  others: 'Other Errand',
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  in_progress: 'bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  completed: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  cancelled: 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200',
}

export default function ErrandDetailPage() {
  const router = useRouter()
  const params = useParams()
  const errandId = params?.id as string

  const [errand, setErrand] = useState<ErrandDetail | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'complete' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<'complete' | 'cancel' | null>(null)

  useEffect(() => {
    const fetchErrandDetail = async () => {
      try {
        setLoading(true)
        const { data } = await authClient.getSession()

        if (!data?.user?.id) {
          router.push('/login')
          return
        }

        // Fetch specific errand
        const errandRes = await fetch(`/api/orders/${errandId}`)
        if (!errandRes.ok) throw new Error('Failed to fetch errand details')

        const errandData = await errandRes.json()
        setErrand(errandData)

        // Fetch the user who placed the order
        const userRes = await fetch(`/api/users/${errandData.userId}`)
        if (userRes.ok) {
          const userData = await userRes.json()
          console.log(userData, "working")
          setUserInfo(userData)
        }
      } catch (err) {
        console.error('Error:', err)
        setError('Failed to load errand details')
      } finally {
        setLoading(false)
      }
    }

    if (errandId) fetchErrandDetail()
  }, [errandId, router])

  const handleAction = async (action: 'complete' | 'cancel') => {
    try {
      setActionLoading(action)
      setShowConfirmModal(null)

      const newStatus = action === 'complete' ? 'completed' : 'cancelled'

      const response = await fetch(`/api/orders/${errandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errData = await response.json()
        setError(errData.error || `Failed to ${action} errand`)
        return
      }

      const updated = await response.json()
      setErrand(updated)

      // Redirect back after a short delay
      setTimeout(() => router.push('/tasker-dashboard'), 1800)
    } catch (err) {
      console.error(`Error ${action}ing errand:`, err)
      setError(`Failed to ${action} errand`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted-foreground font-medium tracking-wide text-sm uppercase">Loading errand</p>
        </div>
      </div>
    )
  }

  if (!errand) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Errand not found</h2>
          <p className="text-muted-foreground mb-6">This errand may have been removed or reassigned.</p>
          <button
            onClick={() => router.push('/tasker-dashboard')}
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Back to Errands
          </button>
        </div>
      </div>
    )
  }

  const isActive = errand.status === 'in_progress' || errand.status === 'pending'
  const isCompleted = errand.status === 'completed'
  const isCancelled = errand.status === 'cancelled'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        .modal-overlay {
          animation: fadeIn 0.15s ease;
        }
        .modal-box {
          animation: slideUp 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .status-badge {
          letter-spacing: 0.05em;
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .info-row {
          border-bottom: 1px solid hsl(var(--border));
          padding: 1rem 0;
          display: flex;
          gap: 1rem;
        }
        .info-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .info-row:first-child {
          padding-top: 0;
        }

        @media (max-width: 640px) {
          .info-row {
            flex-direction: column;
            gap: 0.5rem;
            align-items: stretch;
          }
          .info-row > span:last-child,
          .info-row > a,
          .info-row > div {
            text-align: left;
          }
        }
      `}</style>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="modal-box bg-card border border-border rounded-2xl p-8 max-w-sm w-full shadow-lg">
            <div className="text-4xl mb-4 text-center">
              {showConfirmModal === 'complete' ? '✅' : '⚠️'}
            </div>
            <h3 className="text-xl font-bold text-foreground text-center mb-2">
              {showConfirmModal === 'complete' ? 'Mark as Completed?' : 'Cancel this Errand?'}
            </h3>
            <p className="text-muted-foreground text-center text-sm mb-6">
              {showConfirmModal === 'complete'
                ? 'Confirm that you have successfully delivered and completed this errand.'
                : 'Are you sure you want to cancel? This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 py-3 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors text-sm font-medium cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={() => handleAction(showConfirmModal)}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  showConfirmModal === 'complete'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                }`}
              >
                {showConfirmModal === 'complete' ? 'Yes, Complete' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/tasker/errands')}
            className="w-10 h-10 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
            aria-label="Go back"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Task Details</p>
            <h1 className="font-bold text-foreground text-base sm:text-lg leading-tight">
              {taskTypeIcons[errand.taskType]} {taskTypeLabels[errand.taskType] || errand.taskType}
            </h1>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <span className={`status-badge px-3 py-1.5 rounded-full inline-block ${statusColors[errand.status] || ''}`}>
              {errand.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </header>

      {/* Info for Tasker about payment and platform fee, with breakdown */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <h2 className="font-bold text-blue-900 dark:text-blue-200 text-lg mb-2 flex items-center gap-2">
            💸 Payment & Platform Fee
          </h2>
          <div className="mb-2 text-blue-800 dark:text-blue-300 text-sm">
            <div className="flex flex-wrap gap-4 mb-2">
              <div>
                <span className="font-semibold">Total Amount:</span> ₦{errand.totalAmount?.toLocaleString() || errand.amount?.toLocaleString()}
              </div>
              {typeof errand.commission === 'number' && (
                <div>
                  <span className="font-semibold">Commission:</span> ₦{errand.commission.toLocaleString()}
                </div>
              )}
              {typeof errand.platformFee === 'number' && (
                <div>
                  <span className="font-semibold">Platform Fee:</span> ₦{errand.platformFee.toLocaleString()}
                </div>
              )}
              {typeof errand.taskerFee === 'number' && (
                <div>
                  <span className="font-semibold">Tasker Commission:</span> ₦{errand.taskerFee.toLocaleString()}
                </div>
              )}
            </div>
            <p>
              You will receive the full errand amount <span className="font-semibold">plus your commission</span> after successful completion.<br />
              <span className="font-semibold">Important:</span> You must send the <span className="font-semibold">platform fee</span> to the company within <span className="font-semibold">24 hours</span> of receiving payment.<br />
              <span className="text-red-600 dark:text-red-400 font-semibold">Failure to send the platform fee within 24 hours will result in your account being suspended.</span>
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">

        {/* Error Alert */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            ⚠️ {error}
          </div>
        )}

        {/* Completed / Cancelled Banner */}
        {(isCompleted || isCancelled) && (
          <div className={`rounded-xl p-6 text-center ${
            isCompleted
              ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
              : 'bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900'
          }`}>
            <div className="text-4xl mb-3">{isCompleted ? '🎉' : '❌'}</div>
            <p className={`font-semibold text-lg ${isCompleted ? 'text-emerald-900 dark:text-emerald-200' : 'text-red-900 dark:text-red-200'}`}>
              {isCompleted ? 'Errand Completed!' : 'Errand Cancelled'}
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              {isCompleted ? 'Great work! Payment will be processed shortly.' : 'This errand has been cancelled.'}
            </p>
          </div>
        )}

        {/* Amount Hero Card */}
        <div className="bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-3">Earnings</p>
          <div className="flex items-end gap-2 relative z-10">
            <span className="text-4xl sm:text-5xl font-bold text-primary wrap-break-word">
              ₦{errand.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-4">
            Complete this errand to receive your payment
          </p>
        </div>

        {/* Customer Information */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-bold text-foreground mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm shrink-0">👤</span>
            <span className="text-base sm:text-lg">Customer Information</span>
          </h2>
          <div>
            {userInfo ? (
              <>
                <div className="info-row">
                  <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Full Name</span>
                  <span className="text-foreground font-semibold text-sm sm:text-base">{userInfo.name}</span>
                </div>
                <div className="info-row">
                  <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Phone Number</span>
                  <a
                    href={`tel:${userInfo.phone}`}
                    className="text-primary font-semibold hover:underline transition-colors text-sm sm:text-base flex items-center gap-1.5"
                  >
                    📞 {userInfo.phone}
                  </a>
                </div>
                <div className="info-row">
                  <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Email</span>
                  <a
                    href={`mailto:${userInfo.email}`}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm break-all"
                  >
                    {userInfo.email}
                  </a>
                </div>
                <div className="info-row">
                  <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Delivery Location</span>
                  <span className="text-foreground font-medium text-sm sm:text-base">{errand.location}</span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Customer info unavailable
              </div>
            )}
          </div>
        </div>

        {/* Task Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-bold text-foreground mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-sm shrink-0">📋</span>
            <span className="text-base sm:text-lg">Task Details</span>
          </h2>
          <div>
            <div className="info-row flex-col!">
              <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-2">Description</p>
              <p className="text-foreground text-sm leading-relaxed">{errand.description}</p>
            </div>
            <div className="info-row">
              <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Deadline</span>
              <span className="text-foreground font-medium text-sm sm:text-base flex items-center gap-2">
                ⏱️ {errand.deadlineValue} {errand.deadlineUnit}
              </span>
            </div>
            {errand.store && (
              <div className="info-row">
                <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Store / Vendor</span>
                <span className="text-foreground font-medium text-sm sm:text-base">{errand.store}</span>
              </div>
            )}
            {errand.packaging && (
              <div className="info-row">
                <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Packaging</span>
                <span className="text-foreground font-medium capitalize text-sm sm:text-base">{errand.packaging}</span>
              </div>
            )}
            <div className="info-row">
              <span className="text-muted-foreground text-sm shrink-0 sm:shrink">Order Placed</span>
              <span className="text-muted-foreground text-sm">
                {new Date(errand.createdAt).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isActive && (
          <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 pb-8">
            <button
              onClick={() => setShowConfirmModal('complete')}
              disabled={!!actionLoading}
              className="w-full py-3 sm:py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {actionLoading === 'complete' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Completing...</span>
                  <span className="sm:hidden">Completing</span>
                </>
              ) : (
                <>✅ <span className="hidden sm:inline">Mark as Completed</span><span className="sm:hidden">Complete</span></>
              )}
            </button>

            <button
              onClick={() => setShowConfirmModal('cancel')}
              disabled={!!actionLoading}
              className="w-full py-3 sm:py-4 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-950/60 disabled:opacity-60 disabled:cursor-not-allowed text-red-900 dark:text-red-200 font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {actionLoading === 'cancel' ? (
                <>
                  <div className="w-5 h-5 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Cancelling...</span>
                  <span className="sm:hidden">Cancelling</span>
                </>
              ) : (
                <>✕ <span className="hidden sm:inline">Cancel Errand</span><span className="sm:hidden">Cancel</span></>
              )}
            </button>

            <p className="text-center text-muted-foreground text-xs px-2">
              Cancelling too many errands may affect your rating
            </p>
          </div>
        )}

        {/* Back button for closed errands */}
        {!isActive && (
          <div className="pb-8">
            <button
              onClick={() => router.push('/tasker/errands')}
              className="w-full py-3 sm:py-4 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-medium text-sm sm:text-base cursor-pointer"
            >
              ← Back to Errands
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
