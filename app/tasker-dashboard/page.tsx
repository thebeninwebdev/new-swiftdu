'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { convertToNaira } from '@/lib/utils'
import Link from 'next/link'

interface Errand {
  _id: string
  userId: string
  taskType: string
  description: string
  amount: number
  commission?: number
  platformFee?: number
  taskerFee?: number
  totalAmount?: number
  deadlineValue: number
  deadlineUnit: string
  location: string
  store?: string
  packaging?: string
  status: string
  acceptedBy?: string
  acceptedAt?: string
  createdAt: string
}

interface TaskerData {
  _id: string
  userId: string
  phone: string
  location: string
  rating: number
  completedTasks: number
  isVerified: boolean
  profileImage?: string
}

export default function TaskerErrandsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errands, setErrands] = useState<Errand[]>([])
  const [acceptedErrands, setAcceptedErrands] = useState<Errand[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskerData, setTaskerData] = useState<TaskerData | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'available' | 'accepted'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('accepted') === 'true' ? 'accepted' : 'available'
    }
    return 'available'
  })

  // Keep tab in sync if URL changes after mount
  useEffect(() => {
    if (searchParams?.get('accepted') === 'true') {
      setActiveTab('accepted')
    } else {
      setActiveTab('available')
    }
  }, [searchParams])

  const taskTypes = [
    { value: 'all', label: 'All Tasks' },
    { value: 'restaurant', label: 'Food Delivery' },
    { value: 'printing', label: 'Printing' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'others', label: 'Other Errands' },
  ]

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Get current user session
        const { data } = await authClient.getSession()
        
        if (!data?.user?.id) {
          router.push('/login')
          return
        }

        // Fetch tasker profile
        const taskerRes = await fetch(`/api/taskers?taskerId=${data.user.taskerId}`)
        if (!taskerRes.ok) {
          setError('Failed to load tasker profile')
          return
        }

        const {tasker} = await taskerRes.json()
        setTaskerData(tasker)

        // Check if tasker is verified
        if (!tasker?.isVerified) {
          setError('Your account must be verified to accept errands. Please complete your verification.')
            return
        }


        // Fetch available errands (pending)
        const params = new URLSearchParams()
        if (taskTypeFilter !== 'all') {
          params.append('taskType', taskTypeFilter)
        }
        if (locationFilter) {
          params.append('location', locationFilter)
        }
        params.append('status', 'pending')

        const errandsRes = await fetch(`/api/errands?${params}`)
        if (!errandsRes.ok) {
          throw new Error('Failed to fetch errands')
        }

        const pendingErrands = await errandsRes.json()

        // Fetch the tasker-specific accepted/in-progress tasks, using accepted=true
        const acceptedRes = await fetch(`/api/errands?accepted=true&taskerId=${tasker._id}`)
        if (!acceptedRes.ok) {
          throw new Error('Failed to fetch accepted errands')
        }

        const acceptedErrandsData = await acceptedRes.json()

        setErrands(pendingErrands)
        setAcceptedErrands(acceptedErrandsData)
        setError(null)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load errands')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [taskTypeFilter, locationFilter, router])

  const handleAcceptErrand = async (errandId: string) => {
    try {
      setSubmitting(errandId)
      
      const session = await authClient.getSession()
      if (!session?.data?.user?.id) {
        setError('User not authenticated')
        return
      }

      const response = await fetch('/api/errands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: errandId,
          taskerId: session.data.user.id,
          taskerName: session.data.user.name
        }),
      })

      if (!response.ok) {
        const errData = await response.json()
        setError(errData.error || 'Failed to accept errand')
        return
      }

      const acceptedErrand = await response.json()
      setErrands(errands.filter(e => e._id !== errandId))
      setAcceptedErrands([...acceptedErrands, acceptedErrand])
      setError(null)
    } catch (err) {
      console.error('Error accepting errand:', err)
      setError('Failed to accept errand')
    } finally {
      setSubmitting(null)
    }
  }

  const formatDeadline = (value: number, unit: string) => {
    return `${value} ${unit}`
  }

  const formatTaskType = (type: string) => {
    const taskType = taskTypes.find(t => t.value === type)
    return taskType?.label || type
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading errands...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Available Errands</h1>
              <p className="text-sm text-muted-foreground mt-1">Find and accept tasks to earn money</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Task Type</label>
            <select
              value={taskTypeFilter}
              onChange={(e) => setTaskTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {taskTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Location</label>
            <Input
              type="text"
              placeholder="Search by location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'available'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Available ({errands.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'accepted'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            My Errands ({acceptedErrands.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'available' ? (
          <>
            {errands.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📭</div>
                <h3 className="text-lg font-medium text-foreground">No errands available</h3>
                <p className="text-muted-foreground mt-2">Check back later for new tasks</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {errands.map((errand) => (
                  <div
                    key={errand._id}
                    className="rounded-lg border border-border bg-card hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            {formatTaskType(errand.taskType)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            ₦{(errand.totalAmount || errand.amount).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                        {errand.description}
                      </h3>

                      <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>📍</span>
                          <span>{errand.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>⏱️</span>
                          <span>{formatDeadline(errand.deadlineValue, errand.deadlineUnit)}</span>
                        </div>
                      </div>

                      {errand.store && (
                        <div className="mb-4 text-sm">
                          <span className="text-muted-foreground">Store: </span>
                          <span className="text-foreground font-medium">{errand.store}</span>
                        </div>
                      )}

                      {errand.packaging && (
                        <div className="mb-4 text-sm">
                          <span className="text-muted-foreground">Packaging: </span>
                          <span className="text-foreground font-medium capitalize">{errand.packaging}</span>
                        </div>
                      )}

                      <Button
                        onClick={() => handleAcceptErrand(errand._id)}
                        disabled={submitting === errand._id}
                        className="w-full"
                      >
                        {submitting === errand._id ? 'Accepting...' : 'Accept Errand'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {acceptedErrands.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-foreground">No accepted errands yet</h3>
                <p className="text-muted-foreground mt-2">Accept errands from the available tab to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {acceptedErrands.map((errand) => (
                  <div
                    key={errand._id}
                    className="rounded-lg border border-border bg-card hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <Link href={`/tasker-dashboard/${errand._id}`}>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="inline-flex items-center rounded-md bg-green-100 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                            Accepted
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {convertToNaira(errand.totalAmount || errand.amount)}
                          </div>
                        </div>
                      </div>

                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                        {errand.description}
                      </h3>

                      <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>📍</span>
                          <span>{errand.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>⏱️</span>
                          <span>{formatDeadline(errand.deadlineValue, errand.deadlineUnit)}</span>
                        </div>
                        {errand.acceptedAt && (
                          <div className="flex items-center gap-2">
                            <span>✅</span>
                            <span>Accepted {new Date(errand.acceptedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        In Progress
                      </Button>
                    </div>
                    </Link>
                    
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
