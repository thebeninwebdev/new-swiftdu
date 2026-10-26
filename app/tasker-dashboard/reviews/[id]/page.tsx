'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function ReviewCustomerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => { if (!rating || saving) return; setSaving(true); try { const response = await fetch('/api/customer-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id, rating, comment }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Unable to submit review.'); toast.success('Customer review submitted.'); router.replace('/tasker-dashboard?view=all') } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to submit review.') } finally { setSaving(false) } }
  return <main className="mx-auto min-h-screen max-w-lg px-4 py-8"><Link href="/tasker-dashboard?view=all" className="text-sm font-semibold text-violet-700">← Back to tasks</Link><section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-semibold text-violet-700">Completed task</p><h1 className="mt-1 text-2xl font-black">Review this customer</h1><p className="mt-2 text-sm text-slate-500">Your feedback helps SwiftDU maintain a respectful, reliable community.</p><div className="mt-7 flex justify-between gap-2" aria-label="Customer rating">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`${value} stars`} onClick={() => setRating(value)} className="rounded-xl p-2 transition hover:scale-110"><Star className={`h-9 w-9 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`} /></button>)}</div><p className="mt-2 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">{rating ? `${rating} out of 5` : 'Choose a rating'}</p><label className="mt-6 block text-sm font-bold">Comment <span className="font-normal text-slate-400">(optional)</span><textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={500} rows={5} placeholder="Share helpful feedback about the customer..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" /></label><Button onClick={() => void submit()} disabled={!rating || saving} className="mt-6 h-12 w-full rounded-2xl bg-violet-600 font-bold text-white hover:bg-violet-700">{saving ? 'Submitting...' : 'Submit review'}</Button></section></main>
}
