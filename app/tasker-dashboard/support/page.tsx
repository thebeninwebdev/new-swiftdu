'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getTaskerId } from '@/lib/utils'

interface SupportTicket {
  _id: string
  title: string
  description: string
  category: string
  status: string
  priority: string
  adminResponse?: string
  respondedAt?: string
  createdAt: string
}

interface SupportResponse {
  tickets: SupportTicket[]
  pagination: {
    total: number
    pages: number
  }
}

export default function SupportPage() {
  const [taskerId, setTaskerId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  )
  const [statusFilter, setStatusFilter] = useState('')
  const [data, setData] = useState<SupportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
  })

  useEffect(() => {
    getTaskerId().then((id) => {
      if (id) setTaskerId(id)
    }).catch((err) => {
      console.error('Failed to get tasker ID', err)
    })
  }, [])


  // Fetch support tickets
  useEffect(() => {
    if (!taskerId) return

    const fetchTickets = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams({
          taskerId,
          limit: '20',
          ...(statusFilter && { status: statusFilter }),
        })

        const response = await fetch(`/api/support?${queryParams}`)
        if (!response.ok) {
          throw new Error('Failed to fetch support tickets')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickets()
  }, [taskerId, statusFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    if (formData.title.trim().length < 5) {
      setMessage({
        type: 'error',
        text: 'Title must be at least 5 characters',
      })
      setIsSubmitting(false)
      return
    }

    if (formData.description.trim().length < 20) {
      setMessage({
        type: 'error',
        text: 'Description must be at least 20 characters',
      })
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskerId,
          ...formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setMessage({ type: 'error', text: errorData.error })
        return
      }

      setMessage({
        type: 'success',
        text: 'Support ticket created successfully!',
      })
      setFormData({
        title: '',
        description: '',
        category: 'other',
        priority: 'medium',
      })
      setIsCreating(false)
      // Refetch tickets
      if (taskerId) {
        const queryParams = new URLSearchParams({
          taskerId,
          limit: '20',
          ...(statusFilter && { status: statusFilter }),
        })
        const response = await fetch(`/api/support?${queryParams}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      }
    } catch (error) {
      console.error('Submit error:', error)
      setMessage({ type: 'error', text: 'Failed to create support ticket' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusStyles: Record<string, string> = {
    open: 'bg-red-100 text-red-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  }

  const priorityStyles: Record<string, string> = {
    low: 'text-blue-600',
    medium: 'text-orange-600',
    high: 'text-red-600',
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Support</h1>
              <p className="text-muted-foreground mt-2">
                Report issues and get help from our support team
              </p>
            </div>
            {!isCreating && (
              <Button onClick={() => setIsCreating(true)} className="mt-2">
                New Ticket
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Create Ticket Form */}
        {isCreating && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Create Support Ticket</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Brief summary of your issue"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 5 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Detailed description of your issue"
                  rows={5}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 20 characters
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border border-border bg-background"
                  >
                    <option value="technical">Technical Issue</option>
                    <option value="payment">Payment Issue</option>
                    <option value="order">Order Issue</option>
                    <option value="safety">Safety Concern</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border border-border bg-background"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Ticket'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Filters */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-md border border-border bg-background"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading support tickets...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load support tickets. Please try again.
          </div>
        )}

        {/* Empty State */}
        {data && data.tickets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              No support tickets found.
            </p>
          </div>
        )}

        {/* Tickets List */}
        {data && data.tickets.length > 0 && (
          <div className="space-y-4">
            {data.tickets.map((ticket) => (
              <Card key={ticket._id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{ticket.title}</h3>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          statusStyles[ticket.status] ||
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ticket.status
                          .charAt(0)
                          .toUpperCase() + ticket.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {ticket.description.substring(0, 150)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold text-sm ${
                        priorityStyles[ticket.priority]
                      }`}
                    >
                      {ticket.priority.charAt(0).toUpperCase() +
                        ticket.priority.slice(1)}{' '}
                      Priority
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-medium text-sm capitalize">
                        {ticket.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-medium text-sm">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {ticket.respondedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">Responded</p>
                        <p className="font-medium text-sm">
                          {new Date(ticket.respondedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {ticket.adminResponse && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <p className="text-xs font-semibold text-blue-900 mb-1">
                        Admin Response:
                      </p>
                      <p className="text-sm text-blue-800">
                        {ticket.adminResponse}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
