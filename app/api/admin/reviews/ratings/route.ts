import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Review } from '@/models/review'
import Tasker from '@/models/tasker'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  await connectDB()
  const selectedBand = Number(new URL(request.url).searchParams.get('band') || '')
  const grouped = await Review.aggregate<{ _id: unknown; averageRating: number; reviewCount: number }>([
    { $group: { _id: '$taskerId', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
    { $sort: { averageRating: -1, reviewCount: -1 } },
  ])
  const taskers = await Tasker.find({ _id: { $in: grouped.map((item) => item._id) } }).select('_id userId fullName').populate('userId', 'name').lean()
  const names = Object.fromEntries(taskers.map((tasker) => [tasker._id.toString(), (tasker as { userId?: { name?: string } }).userId?.name || tasker.fullName || 'Unknown tasker']))
  const items = grouped.map((item) => ({ taskerId: String(item._id), taskerName: names[String(item._id)] || 'Unknown tasker', averageRating: Number(item.averageRating.toFixed(1)), reviewCount: item.reviewCount }))
  const bands = [5, 4, 3, 2, 1, 0].map((band) => ({ band, count: items.filter((item) => band === 0 ? item.averageRating === 0 : item.averageRating >= band && item.averageRating < band + 1).length }))
  return NextResponse.json({ bands, taskers: Number.isInteger(selectedBand) ? items.filter((item) => selectedBand === 0 ? item.averageRating === 0 : item.averageRating >= selectedBand && item.averageRating < selectedBand + 1) : [] })
}
