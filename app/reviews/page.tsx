'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'
interface Order {
  taskerId: string
  _id: string
  taskType: string
  description: string
  amount: number
  taskerName: string
  status: string
  createdAt: string
  acceptedAt: string
}

export default function CustomerReviewsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [completedOrders, setCompletedOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  )

  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: '',
  })

  // Get userId from session
  useEffect(() => {
    const getUserId = async () => {
      try {
        const {data} = await authClient.getSession()
        if (data?.user?.id) {
          setUserId(data.user.id)
        }
      } catch (error) {
        console.error('Error fetching session:', error)
      }
    }
    getUserId()
  }, [])

  // Fetch completed orders
  useEffect(() => {
    if (!userId) return

    const fetchCompletedOrders = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/orders?userId=${userId}&status=completed`
        )
        if (!response.ok) {
          throw new Error('Failed to fetch completed orders')
        }
        const result = await response.json()
        setCompletedOrders(result || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompletedOrders()
  }, [userId])

  const handleSubmitReview = async (orderId: string, taskerId: string) => {
    if (!userId) {
      setMessage({ type: 'error', text: 'User not authenticated' })
      return
    }

    if (!reviewForm.comment.trim()) {
      setMessage({ type: 'error', text: 'Please write a comment' })
      return
    }

    setIsSubmittingReview(true)
    setMessage(null)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          orderId,
          taskerId,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit review')
      }

      setMessage({
        type: 'success',
        text: 'Review submitted successfully!',
      })

      // Reset form and remove from list
      setReviewForm({ rating: 5, comment: '' })
      setReviewingOrderId(null)
      setCompletedOrders((prev) =>
        prev.filter((order) => order._id !== orderId)
      )
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit review',
      })
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const getTaskTypeName = (type: string) => {
    const types: Record<string, string> = {
      restaurant: 'Restaurant Order',
      printing: 'Printing Service',
      shopping: 'Shopping',
      others: 'Other Errand',
    }
    return types[type] || type
  }

  if (isLoading && completedOrders.length === 0) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading completed orders...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Share Your Feedback
          </h1>
          <p className="text-muted-foreground">
            Rate your completed errands and help taskers improve their service
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {message?.type === 'success' && (
          <div className="p-4 rounded-md bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-200">
              {message.text}
            </p>
          </div>
        )}

        {/* Error Message */}
        {message?.type === 'error' && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">{message.text}</p>
          </div>
        )}

        {/* Empty State */}
        {completedOrders.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No completed orders to review yet
            </p>
            <p className="text-sm text-muted-foreground">
              Once you complete orders, you&apos;ll be able to leave reviews here
            </p>
          </Card>
        )}

        {/* Orders List */}
        <div className="space-y-4">
          {completedOrders.map((order) => (
            <Card key={order._id} className="p-6 space-y-4">
              {/* Order Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {getTaskTypeName(order.taskType)}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {order.description}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-lg font-bold text-foreground">
                    ₦{order.amount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Order Details */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Tasker
                  </p>
                  <p className="font-medium text-foreground">
                    {order.taskerName || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Status
                  </p>
                  <p className="font-medium text-green-600 dark:text-green-400 capitalize">
                    {order.status}
                  </p>
                </div>
              </div>

              {/* Review Form or Button */}
              {reviewingOrderId === order._id ? (
                <div className="space-y-4 pt-4 border-t border-border">
                  {/* Rating Selector */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      How was your experience? *
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() =>
                            setReviewForm((prev) => ({
                              ...prev,
                              rating: star,
                            }))
                          }
                          className={`text-3xl transition-colors ${
                            star <= reviewForm.rating
                              ? 'text-yellow-400'
                              : 'text-gray-300 hover:text-yellow-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Your Feedback (optional)
                    </label>
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          comment: e.target.value,
                        }))
                      }
                      placeholder="Share your experience with this tasker..."
                      maxLength={500}
                      className="w-full px-3 py-2 rounded-md border-2 border-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 resize-none dark:bg-input/30 dark:border-input"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {reviewForm.comment.length}/500
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleSubmitReview(order._id, order?.taskerId)}
                      disabled={isSubmittingReview}
                      className="flex-1"
                    >
                      {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                    </Button>
                    <Button
                      onClick={() => {
                        setReviewingOrderId(null)
                        setReviewForm({ rating: 5, comment: '' })
                      }}
                      variant="outline"
                      className="flex-1"
                      disabled={isSubmittingReview}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    setReviewingOrderId(order._id)
                    setReviewForm({ rating: 5, comment: '' })
                  }}
                  variant="default"
                  className="w-full"
                >
                  Leave Review
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
