'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Layers3, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BatchOrder = {
  _id: string
  batchId?: string
  batchStatus?: string
  batchingStatus?: string
  batchWindowStart?: string
  batchWindowEnd?: string
  indomieRunAt?: string
  indomieRunStatus?: string
  scheduledFor?: string
  indomiePacks?: number
  eggCount?: number
  status: string
  paymentStatus?: string
  taskerName?: string
  location?: string
  isTestOrder?: boolean
  createdAt: string
}

type PersistedBatch = {
  _id: string
  windowStart: string
  windowEnd: string
  destinationLabel?: string
  orderIds: string[]
  orderCount: number
  status: string
  taskerName?: string
  isTestBatch?: boolean
}

type BatchResponse = {
  orders: BatchOrder[]
  batches: PersistedBatch[]
  session?: { name?: string }
}

function formatRunTime(value?: string) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function stateLabel(order: BatchOrder) {
  return order.indomieRunStatus || order.batchStatus || order.batchingStatus || order.status
}

export function AdminIndomieBatches() {
  const [data, setData] = useState<BatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/orders?view=indomie-batches', { cache: 'no-store', signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load Indomie batches.')
      setData(payload)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Could not load Indomie batches.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const persistedOrderIds = useMemo(
    () => new Set((data?.batches || []).flatMap((batch) => batch.orderIds.map(String))),
    [data?.batches]
  )
  const unmaterializedOrders = (data?.orders || []).filter((order) => !persistedOrderIds.has(String(order._id)))

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Indomie batch monitoring</h2>
          <p className="mt-1 text-sm text-slate-600">
            Existing runs and persisted batches in the active academic session{data?.session?.name ? ` · ${data.session.name}` : ''}.
          </p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div role="status" className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-44 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {error}
        </div>
      ) : !data?.batches.length && !data?.orders.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Layers3 className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-semibold">No Indomie runs in this academic session</p>
          <p className="mt-1 text-sm text-slate-500">New scheduled orders and materialized batches will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(data?.batches || []).length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {data!.batches.map((batch) => {
                const orders = data!.orders.filter((order) => batch.orderIds.includes(String(order._id)))
                const packs = orders.reduce((sum, order) => sum + Number(order.indomiePacks || 0), 0)
                const eggs = orders.reduce((sum, order) => sum + Number(order.eggCount || 0), 0)
                return (
                  <article key={batch._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Persisted batch</p><h3 className="mt-1 break-all font-bold">{batch._id}</h3></div>
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold capitalize text-violet-700">{batch.status.replaceAll('_', ' ')}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div><p className="text-slate-500">Run</p><p className="font-semibold">{formatRunTime(batch.windowEnd || batch.windowStart)}</p></div>
                      <div><p className="text-slate-500">Orders</p><p className="font-semibold">{batch.orderCount}</p></div>
                      <div><p className="text-slate-500">Packs / eggs</p><p className="font-semibold">{packs} / {eggs}</p></div>
                      <div><p className="text-slate-500">Tasker</p><p className="font-semibold">{batch.taskerName || orders.find((order) => order.taskerName)?.taskerName || 'Unassigned'}</p></div>
                      <div><p className="text-slate-500">Destination</p><p className="font-semibold">{batch.destinationLabel || orders[0]?.location || 'Not set'}</p></div>
                      <div><p className="text-slate-500">Mode</p><p className="font-semibold">{batch.isTestBatch ? 'Training' : 'Live'}</p></div>
                    </div>
                    {orders.length > 0 && <p className="mt-4 text-xs text-slate-500">Order states: {orders.map((order) => `${order.status}/${order.paymentStatus || 'unpaid'}`).join(', ')}</p>}
                  </article>
                )
              })}
            </div>
          )}

          {unmaterializedOrders.length > 0 && (
            <div>
              <h3 className="mb-3 font-bold">Scheduled and unmaterialized orders</h3>
              <p className="mb-4 text-sm text-slate-500">These orders are shown using their persisted run and batching fields; no batch is synthesized.</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {unmaterializedOrders.map((order) => (
                  <article key={order._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="break-all text-sm font-semibold">{order.batchId || order._id}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />{formatRunTime(order.indomieRunAt || order.scheduledFor || order.batchWindowEnd)}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">{stateLabel(order).replaceAll('_', ' ')}</span></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><p className="text-slate-500">Packs</p><p className="font-semibold">{order.indomiePacks || 0}</p></div><div><p className="text-slate-500">Eggs</p><p className="font-semibold">{order.eggCount || 0}</p></div><div><p className="text-slate-500">Tasker</p><p className="font-semibold">{order.taskerName || 'Unassigned'}</p></div><div><p className="text-slate-500">Order/payment</p><p className="font-semibold capitalize">{order.status} / {order.paymentStatus || 'unpaid'}</p></div></div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
