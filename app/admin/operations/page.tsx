'use client'

import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const toMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
const toTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

export default function OperationsAdminPage() {
  const [open, setOpen] = useState('07:00'), [close, setClose] = useState('22:00')
  const [start, setStart] = useState('18:00'), [end, setEnd] = useState('21:00'), [interval, setInterval] = useState('30'), [cutoff, setCutoff] = useState('10')
  const [loading, setLoading] = useState(true), [savingHours, setSavingHours] = useState(false), [savingBatching, setSavingBatching] = useState(false)

  useEffect(() => {
    void Promise.all([fetch('/api/admin/operations'), fetch('/api/admin/indomie-batching')])
      .then(async ([operationsResponse, batchingResponse]) => {
        const [operations, batching] = await Promise.all([operationsResponse.json(), batchingResponse.json()])
        if (!operationsResponse.ok) throw new Error(operations.error)
        if (!batchingResponse.ok) throw new Error(batching.error)
        setOpen(toTime(operations.openMinute)); setClose(toTime(operations.closeMinute))
        setStart(toTime(batching.startMinute)); setEnd(toTime(batching.endMinute)); setInterval(String(batching.runIntervalMinutes)); setCutoff(String(batching.bookingCutoffMinutes))
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Unable to load operations settings.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveHours(event: React.FormEvent) {
    event.preventDefault(); setSavingHours(true)
    try {
      const response = await fetch('/api/admin/operations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openMinute: toMinutes(open), closeMinute: toMinutes(close) }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      toast.success('SwiftDU operating hours saved.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save operating hours.') } finally { setSavingHours(false) }
  }

  async function saveBatching(event: React.FormEvent) {
    event.preventDefault(); setSavingBatching(true)
    try {
      const response = await fetch('/api/admin/indomie-batching', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startMinute: toMinutes(start), endMinute: toMinutes(end), runIntervalMinutes: Number(interval), bookingCutoffMinutes: Number(cutoff) }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      toast.success('Indomie batching schedule saved.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save batching settings.') } finally { setSavingBatching(false) }
  }

  return <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-10"><header className="mb-6"><p className="text-sm font-semibold text-violet-700">Operations</p><h1 className="mt-1 text-3xl font-bold">Operating hours & Indomie batching</h1><p className="mt-2 text-sm text-slate-600">All times use Africa/Lagos.</p></header><div className="grid gap-6 lg:grid-cols-2"><form onSubmit={saveHours} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">SwiftDU operating hours</h2><div className="mt-4 flex gap-3 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><Clock3 className="h-5 w-5 shrink-0" />Customers can place new live orders only during these hours. Existing orders continue after closing.</div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><label className="font-medium">Opening time<input disabled={loading} required type="time" value={open} onChange={event => setOpen(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label className="font-medium">Closing time<input disabled={loading} required type="time" value={close} onChange={event => setClose(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label></div><Button type="submit" disabled={loading || savingHours} className="mt-6 bg-violet-600 hover:bg-violet-700">{savingHours ? 'Saving…' : 'Save operating hours'}</Button></form><form onSubmit={saveBatching} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Indomie batching</h2><div className="mt-4 flex gap-3 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><Clock3 className="h-5 w-5 shrink-0" />Before this period Indomie is a normal task. After it ends, new Indomie orders are closed.</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label>Starts<input disabled={loading} required type="time" value={start} onChange={event => setStart(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label>Ends<input disabled={loading} required type="time" value={end} onChange={event => setEnd(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label>Run every<select disabled={loading} value={interval} onChange={event => setInterval(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3">{[15, 20, 30, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label><label>Booking closes<select disabled={loading} value={cutoff} onChange={event => setCutoff(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3">{[5, 10, 15, 20].map(value => <option key={value} value={value}>{value} minutes before departure</option>)}</select></label></div><Button type="submit" disabled={loading || savingBatching} className="mt-6 bg-violet-600 hover:bg-violet-700">{savingBatching ? 'Saving…' : 'Save batching schedule'}</Button></form></div></div>
}
