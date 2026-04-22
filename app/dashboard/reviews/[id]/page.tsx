'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Star, 
  ArrowLeft, 
  CheckCircle2, 
  MessageSquare,
  Tag,
  Send,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import type { Variants } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface Order {
  _id: string
  taskerId: string
  taskType: string
  description: string
  amount: number
  totalAmount?: number
  taskerName?: string
  status: string
  completedAt?: string
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

const ratingLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Excellent']

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
}

const starContainerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
}

const starVariants: Variants = {
  hidden: { opacity: 0, scale: 0, rotate: -180 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
}

const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 100 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  },
  exit: {
    opacity: 0,
    y: 100,
    transition: { duration: 0.3 },
  },
}

export default function ReviewOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/orders/${orderId}`)
        if (!res.ok) throw new Error('Order not found')

        const data = await res.json()

        if (data.status !== 'completed') {
          throw new Error('This order is not ready for review')
        }

        setOrder(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order')
      } finally {
        setLoading(false)
      }
    }

    if (orderId) void fetchOrder()
  }, [orderId])

  const handleSubmit = async () => {
    if (!order) return

    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    if (comment.trim().length < 10) {
      toast.error('Please write at least 10 characters of feedback.')
      return
    }

    try {
      setSubmitting(true)

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order._id,
          taskerId: order.taskerId,
          rating,
          comment,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit review')

      setShowSuccess(true)
      
      // Delay redirect for success animation
      setTimeout(() => {
        router.replace('/dashboard')
      }, 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit review')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Spinner className="size-10 text-primary" />
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
        </motion.div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4"
      >
        <Card className="w-full max-w-md border-red-200 bg-red-50/50 dark:bg-red-900/20">
          <CardContent className="pt-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"
            >
              <X className="h-8 w-8 text-red-600 dark:text-red-400" />
            </motion.div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Oops! Something went wrong
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              {error || 'Order not found'}
            </p>
            <Button 
              onClick={() => router.back()} 
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 pb-24">
      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-sm"
            >
              <Card className="border-green-200 bg-white dark:bg-slate-900 shadow-2xl">
                <CardContent className="pt-8 pb-8 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50"
                  >
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2"
                  >
                    Thank You!
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-slate-600 dark:text-slate-400"
                  >
                    Your review has been submitted successfully.
                  </motion.p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-16 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 lg:top-0"
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold">Write a Review</h1>
          <div className="w-10" />
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto px-4 py-6 space-y-6"
      >
        {/* Tasker Info Card */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-slate-900">
            <div className="h-2 bg-linear-to-r from-primary via-primary/80 to-primary/60" />
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <div className="h-16 w-16 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {order.taskerName?.charAt(0) || 'T'}
                  </div>
                  <motion.div
                    className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                  </motion.div>
                </motion.div>
                
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    {order.taskerName || 'Tasker'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                    <Tag className="h-3.5 w-3.5" />
                    <span className="truncate">{order.taskType}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm font-medium text-primary">
                    {formatCurrency(order.totalAmount || order.amount)}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                  {order.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rating Section */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                How was your experience?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Animated Star Rating */}
              <motion.div 
                variants={starContainerVariants}
                initial="hidden"
                animate="visible"
                className="flex justify-center gap-2"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <motion.button
                    key={value}
                    variants={starVariants}
                    whileHover={{ scale: 1.2, rotate: 15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="relative p-2 focus:outline-none"
                  >
                    <motion.div
                      animate={{
                        scale: value <= (hoverRating || rating) ? [1, 1.3, 1] : 1,
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <Star
                        className={`h-10 w-10 transition-all duration-300 ${
                          value <= (hoverRating || rating)
                            ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg'
                            : 'fill-slate-100 text-slate-300 dark:fill-slate-800 dark:text-slate-600'
                        }`}
                      />
                    </motion.div>
                    {value <= rating && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl -z-10"
                      />
                    )}
                  </motion.button>
                ))}
              </motion.div>

              {/* Rating Label */}
              <AnimatePresence mode="wait">
                {(hoverRating || rating) > 0 && (
                  <motion.div
                    key={hoverRating || rating}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center"
                  >
                    <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {ratingLabels[(hoverRating || rating) - 1]}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {rating === 0 && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-slate-400"
                >
                  Tap a star to rate
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Comment Section */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Share your feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div
                whileFocus={{ scale: 1.01 }}
                className="relative"
              >
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about your experience... What went well? What could be improved?"
                  className="w-full min-h-35 p-4 text-sm bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary/30 rounded-2xl resize-none transition-all duration-300 outline-none placeholder:text-slate-400"
                  rows={5}
                />
                <motion.div
                  className="absolute bottom-3 right-3 text-xs text-slate-400"
                  animate={{
                    color: comment.length >= 10 ? '#22c55e' : '#94a3b8',
                  }}
                >
                  {comment.length} chars
                </motion.div>
              </motion.div>

              {/* Quick Tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {['Great service', 'On time', 'Professional', 'Would recommend'].map((tag, i) => (
                  <motion.button
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setComment(prev => 
                      prev ? `${prev} ${tag.toLowerCase()}` : tag
                    )}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    + {tag}
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Sticky Submit Button */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800"
      >
        <div className="max-w-2xl mx-auto">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || rating === 0}
              className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
            >
              {submitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Spinner className="size-5" />
                </motion.div>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit Review
                </>
              )}
            </Button>
          </motion.div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Your feedback helps improve our community
          </p>
        </div>
      </motion.div>
    </div>
  )
}
