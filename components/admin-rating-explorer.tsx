'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

type Band = { band: number; count: number }
type Tasker = { taskerId: string; taskerName: string; averageRating: number; reviewCount: number }
type Review = { _id: string; rating: number; comment: string; userName: string; createdAt: string }

export function AdminRatingExplorer() {
  const [bands, setBands] = useState<Band[]>([])
  const [taskers, setTaskers] = useState<Tasker[]>([])
  const [selectedBand, setSelectedBand] = useState<number | null>(null)
  const [selectedTasker, setSelectedTasker] = useState<Tasker | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => { void fetch('/api/admin/reviews/ratings').then((response) => response.ok ? response.json() : null).then((data) => setBands(data?.bands || [])) }, [])
  const chooseBand = async (band: number) => {
    setSelectedBand(band); setSelectedTasker(null); setReviews([])
    const response = await fetch(`/api/admin/reviews/ratings?band=${band}`)
    if (response.ok) setTaskers((await response.json()).taskers || [])
  }
  const chooseTasker = async (tasker: Tasker) => {
    setSelectedTasker(tasker)
    const response = await fetch(`/api/admin/reviews?taskerId=${tasker.taskerId}&page=1`)
    if (response.ok) setReviews((await response.json()).reviews || [])
  }
  return <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="font-semibold text-slate-900">Tasker ratings</h2><p className="mt-1 text-sm text-slate-500">Average rating bands. Select a band, then a tasker to read every rating.</p></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6">{[5, 4, 3, 2, 1, 0].map((band) => { const count = bands.find((item) => item.band === band)?.count || 0; return <button key={band} type="button" onClick={() => void chooseBand(band)} className={`min-h-16 rounded-2xl border px-3 text-left transition-colors ${selectedBand === band ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-slate-200 hover:bg-slate-50'}`}><span className="flex items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{band} star{band === 1 ? '' : 's'}</span><span className="mt-1 block text-xs text-slate-500">{count} tasker{count === 1 ? '' : 's'}</span></button>})}</div>{selectedBand !== null && <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-slate-700">Taskers averaging {selectedBand} star{selectedBand === 1 ? '' : 's'}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{taskers.length ? taskers.map((tasker) => <button key={tasker.taskerId} type="button" onClick={() => void chooseTasker(tasker)} className={`rounded-2xl border p-3 text-left ${selectedTasker?.taskerId === tasker.taskerId ? 'border-violet-200 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}><p className="font-semibold text-slate-900">{tasker.taskerName}</p><p className="mt-1 text-sm text-slate-500">Average {tasker.averageRating}/5 · {tasker.reviewCount} rating{tasker.reviewCount === 1 ? '' : 's'}</p></button>) : <p className="text-sm text-slate-500">No taskers in this band.</p>}</div></div>}{selectedTasker && <div className="mt-5 border-t border-slate-100 pt-5"><p className="font-semibold text-slate-900">All ratings for {selectedTasker.taskerName}</p><div className="mt-3 space-y-2">{reviews.map((review) => <div key={review._id} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-900">{review.rating}/5 stars · {review.userName}</p><p className="mt-1 text-sm text-slate-600">{review.comment || 'No written comment.'}</p><p className="mt-1 text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString('en-NG')}</p></div>)}</div></div>}</section>
}
