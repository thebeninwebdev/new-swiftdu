import { Types } from 'mongoose'

import { Order } from '@/models/order'
import { Review } from '@/models/review'
import Tasker from '@/models/tasker'

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

export async function calculateTaskerStats(taskerId: string): Promise<TaskerStats> {
  const [completedTasks, reviewSummary] = await Promise.all([
    Order.countDocuments({ taskerId, status: 'completed' }),
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
