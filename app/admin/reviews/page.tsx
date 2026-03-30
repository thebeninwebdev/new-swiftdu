'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Star,
  Search,
  User,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Eye,
  Trash2
} from 'lucide-react'

interface Review {
  _id: string
  userId: string
  userName: string
  userEmail: string
  taskerId: string
  taskerName: string
  orderId: string
  rating: number
  comment: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminReviewsPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) {
          router.push('/login')
          return
        }
        // TODO: Add admin role check
        setAdmin(data.user)
      } catch {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    setIsFetching(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        rating: ratingFilter,
        visibility: visibilityFilter
      })

      const res = await fetch(`/api/admin/reviews?${params}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to load reviews')
        return
      }

      setReviews(data.reviews)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('Failed to load reviews')
    } finally {
      setIsFetching(false)
    }
  }, [currentPage, searchTerm, ratingFilter, visibilityFilter])

  useEffect(() => {
    if (admin) fetchReviews()
  }, [admin, fetchReviews])

  // Handle review actions
  const handleReviewAction = async (reviewId: string, action: 'hide' | 'show' | 'delete') => {
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Action failed')
        return
      }

      toast.success(
        action === 'hide' ? 'Review hidden' :
        action === 'show' ? 'Review made visible' :
        'Review deleted'
      )

      // Refresh reviews list
      fetchReviews()
    } catch {
      toast.error('Something went wrong')
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!admin) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Review Management</h1>
              <p className="text-muted-foreground mt-1">Monitor and moderate user reviews</p>
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              Admin Panel
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>

              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="visible">Visible</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={() => setCurrentPage(1)} disabled={isFetching}>
                {isFetching ? 'Loading...' : 'Apply Filters'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No reviews found</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review._id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{review.userName}</h3>
                          <div className="flex items-center">
                            {renderStars(review.rating)}
                          </div>
                          <Badge variant={review.isVisible ? 'default' : 'secondary'}>
                            {review.isVisible ? 'Visible' : 'Hidden'}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          Review for {review.taskerName} • {new Date(review.createdAt).toLocaleDateString()}
                        </p>

                        <p className="text-sm mb-3">{review.comment}</p>

                        <div className="text-xs text-muted-foreground">
                          <span>Order ID: {review.orderId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === review._id ? null : review._id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewAction(review._id, review.isVisible ? 'hide' : 'show')}
                      >
                        {review.isVisible ? <ThumbsDown className="w-4 h-4" /> : <ThumbsUp className="w-4 h-4" />}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewAction(review._id, 'delete')}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === review._id && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Reviewer</p>
                          <p className="text-sm">{review.userName}</p>
                          <p className="text-xs text-muted-foreground">{review.userEmail}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Tasker Reviewed</p>
                          <p className="text-sm">{review.taskerName}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Rating</p>
                          <div className="flex items-center space-x-1">
                            {renderStars(review.rating)}
                            <span className="text-sm ml-2">{review.rating}/5</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Visibility</p>
                          <Badge variant={review.isVisible ? 'default' : 'secondary'}>
                            {review.isVisible ? 'Visible to users' : 'Hidden from users'}
                          </Badge>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Created</p>
                          <p className="text-sm">
                            {new Date(review.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Last Updated</p>
                          <p className="text-sm">
                            {new Date(review.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Full Review</p>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-sm">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8 space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <span className="px-4 py-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}