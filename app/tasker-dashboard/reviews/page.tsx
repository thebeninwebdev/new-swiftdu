'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'

interface Review {
  _id: string
  rating: number
  comment: string
  createdAt: string
  userId: {
    name: string
    profileImage?: string
  }
  orderId: {
    taskType: string
    amount: number
  }
}

interface ReviewsResponse {
  reviews: Review[]
  pagination: {
    total: number
    pages: number
  }
}

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-lg ${
            star <= Math.floor(rating)
              ? 'text-yellow-400'
              : 'text-gray-300'
          }`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [taskerId, setTaskerId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getTaskerId = async () => {
      try {
        const session = await fetch('/api/auth/session').then((r) => r.json())
        if (session?.user?.id) {
          setTaskerId(session.user.id)
        }
      } catch (error) {
        console.error('Error fetching session:', error)
      }
    }
    getTaskerId()
  }, [])

  // Fetch reviews
  useEffect(() => {
    if (!taskerId) return

    const fetchReviews = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams({
          taskerId,
          page: page.toString(),
          limit: '10',
        })

        const response = await fetch(`/api/reviews?${queryParams}`)
        if (!response.ok) {
          throw new Error('Failed to fetch reviews')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [taskerId, page])

  // Calculate average rating
  const averageRating =
    data && data.reviews.length > 0
      ? (
          data.reviews.reduce((sum, review) => sum + review.rating, 0) /
          data.reviews.length
        ).toFixed(1)
      : 0

  const getRatingDistribution = () => {
    if (!data || data.reviews.length === 0) return {}
    const distribution: Record<number, number> = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    }
    data.reviews.forEach((review) => {
      distribution[review.rating]++
    })
    return distribution
  }

  const distribution = getRatingDistribution()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground">My Reviews</h1>
          <p className="text-muted-foreground mt-2">
            See feedback from customers about your service
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading reviews...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load reviews. Please try again.
          </div>
        )}

        {data && (
          <>
            {/* Summary Card */}
            <Card className="p-8 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Average Rating
                  </p>
                  <p className="text-5xl font-bold text-blue-900">
                    {averageRating}
                  </p>
                  <StarRating rating={parseFloat(averageRating.toString())} />
                  <p className="text-sm text-muted-foreground mt-2">
                    Based on {data.pagination.total} reviews
                  </p>
                </div>

                {/* Rating Distribution */}
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div
                      key={star}
                      className="flex items-center gap-3"
                    >
                      <span className="text-sm font-medium w-8">
                        {star}
                      </span>
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{
                            width: `${
                              data.reviews.length > 0
                                ? (
                                    ((distribution[star] || 0) /
                                      data.reviews.length) *
                                    100
                                  ).toFixed(0)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">
                        {distribution[star] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Empty State */}
            {data.reviews.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-2">
                  No reviews yet
                </p>
                <p className="text-muted-foreground">
                  Complete tasks to start receiving reviews from customers
                </p>
              </div>
            )}

            {/* Reviews List */}
            {data.reviews.length > 0 && (
              <div className="space-y-4">
                {data.reviews.map((review) => (
                  <Card key={review._id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {review.userId.profileImage ? (
                            <img
                              src={review.userId.profileImage}
                              alt={review.userId.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                              {review.userId.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold">
                              {review.userId.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>

                    <p className="text-foreground mb-4">{review.comment}</p>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">
                        Task:
                      </p>
                      <p className="text-sm font-medium">
                        {review.orderId.taskType.charAt(0).toUpperCase() +
                          review.orderId.taskType.slice(1)}{' '}
                        - ${review.orderId.amount.toFixed(2)}
                      </p>
                    </div>
                  </Card>
                ))}

                {/* Pagination */}
                {data.pagination.pages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-md border border-border hover:bg-muted disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {data.pagination.pages}
                    </span>
                    <button
                      onClick={() =>
                        setPage(Math.min(data.pagination.pages, page + 1))
                      }
                      disabled={page === data.pagination.pages}
                      className="px-4 py-2 rounded-md border border-border hover:bg-muted disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
