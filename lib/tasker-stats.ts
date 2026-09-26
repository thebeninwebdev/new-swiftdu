import { Types } from 'mongoose'

import { Order } from '@/models/order'
import { Review } from '@/models/review'
import Tasker from '@/models/tasker'
import { excludeTestOrders } from '@/lib/order-finance'

export interface TaskerStats {
  completedTasks: number
  rating: number
  reviewCount: number
}

interface ReviewSummary {
  _id: null
  rating: number
  reviewCount: number
}

export async function calculateTaskerPeriodStats(taskerId: string, starts: Record<'today' | 'week' | 'month', Date>) {
  const pairs = await Promise.all(Object.entries(starts).map(async ([period, start]) => {
    const [result] = await Order.aggregate([
      { $match: excludeTestOrders({ taskerId, status: 'completed', completedAt: { $gte: start } }) },
      { $group: { _id: null, tasks: { $sum: 1 }, earnings: { $sum: {
        $cond: [{ $and: [{ $eq: ['$serviceFeeDiscountApplied', true] }, { $gt: ['$discountCommissionAmount', 0] }] }, '$discountCommissionAmount', { $ifNull: ['$taskerFee', 0] }],
      } } } },
    ])
    return [period, { tasks: Number(result?.tasks || 0), earnings: Number(result?.earnings || 0) }] as const
  }))
  return Object.fromEntries(pairs) as Record<'today' | 'week' | 'month', { tasks: number; earnings: number }>
}

export async function calculateTaskerStats(taskerId: string): Promise<TaskerStats> {
  const [completedTasks, reviewSummary] = await Promise.all([
    Order.countDocuments(excludeTestOrders({ taskerId, status: 'completed' })),
    Types.ObjectId.isValid(taskerId)
      ? Review.aggregate<ReviewSummary>([
          {
            $match: {
              taskerId: new Types.ObjectId(taskerId),
            },
          },
          {
            $group: {
              _id: null,
              rating: { $avg: '$rating' },
              reviewCount: { $sum: 1 },
            },
          },
        ])
      : Promise.resolve([]),
  ])

  const summary = reviewSummary[0]

  return {
    completedTasks,
    rating: summary?.rating ?? 0,
    reviewCount: summary?.reviewCount ?? 0,
  }
}

export async function syncTaskerStats(taskerId: string): Promise<TaskerStats> {
  const stats = await calculateTaskerStats(taskerId)

  await Tasker.findByIdAndUpdate(taskerId, {
    completedTasks: stats.completedTasks,
    rating: stats.rating,
  })

  return stats
}
