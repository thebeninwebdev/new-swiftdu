'use client'

import { useState } from 'react'
import { OrderMascot } from '@/components/order-mascot'
import { getCafeLabel, cafeStatusLabels, calculateCafeSelection, type CafeInquiryFields } from '@/lib/cafe-inquiry'
import { CAFE_INQUIRY_EXTRA_FEE, RESTAURANT_MAX_PEOPLE } from '@/lib/pricing'

const money = (amount: number) => `₦${amount.toLocaleString('en-NG')}`
const field = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900'
const button = 'rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50'

export function CafeInquirySelector({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2" aria-label="Restaurant order type">
    {[false, true].map(inquiry => <button type="button" key={String(inquiry)} aria-pressed={value === inquiry} onClick={() => onChange(inquiry)} className={`rounded-2xl border-2 p-4 text-left ${value === inquiry ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>
      <span className="block font-bold">{inquiry ? 'Show me what’s available' : 'I know what I want'}</span>
      <span className="mt-1 block text-sm">{inquiry ? 'A Tasker will check the cafe first.' : 'Tell us your order and food budget.'}</span>
      {inquiry && <span className="mt-2 inline-block rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold">+{money(CAFE_INQUIRY_EXTRA_FEE)} cafe check</span>}
    </button>)}
  </div>
}

export function CafeInquiryReview({ cafe, location, serviceFee, discounted }: { cafe: string; location: string; serviceFee: number; discounted: boolean }) {
  const base = serviceFee - CAFE_INQUIRY_EXTRA_FEE
  return <div className="space-y-3 rounded-2xl border border-indigo-100 bg-white p-5 text-sm text-slate-900">
    <h3 className="text-lg font-bold">Cafe check</h3>
    <p>Your Tasker will check what&apos;s available before you choose your food.</p>
    <dl className="space-y-3">{[['Cafe', cafe], ['Request', 'Check what’s available'], ['Deliver to', location], ['SwiftDU service fee', discounted ? `${money(base)} — waived` : money(base)], ['Cafe check fee', money(CAFE_INQUIRY_EXTRA_FEE)], ['Total service charge', money((discounted ? 0 : base) + CAFE_INQUIRY_EXTRA_FEE)]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}</dl>
    <p className="text-xs text-slate-600">Requesting commits you to this service charge. It is included once in your final transfer, together with food and any packaging costs. No transfer is needed yet.</p>
  </div>
}

type CafeOrder = CafeInquiryFields & { _id: string; store?: string; status: string; hasPaid?: boolean; serviceFeeDiscountApplied?: boolean }
export function CafeInquiryPanel({ order, tasker = false, onUpdated }: { order: CafeOrder; tasker?: boolean; onUpdated: () => void }) {
  // Remount the draft when options are corrected; never submit a stale draft against a new price.
  return <CafeInquiryDraft key={`${order._id}:${order.cafeOptionsVersion}`} order={order} tasker={tasker} onUpdated={onUpdated} />
}
function CafeInquiryDraft({ order, tasker, onUpdated }: { order: CafeOrder; tasker: boolean; onUpdated: () => void }) {
  const [rows, setRows] = useState(() => order.cafeAvailableItems?.length ? order.cafeAvailableItems.map(item => ({ name: item.name, price: String(item.price) })) : [{ name: '', price: '' }])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [people, setPeople] = useState(1)
  const [takeaway, setTakeaway] = useState<number | undefined>()
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = order.cafeInquiryStatus
  if (!state) return null
  const active = order.status === 'in_progress' && !order.hasPaid
  const canSend = active && ['checking_cafe', 'awaiting_customer_choice', 'unavailable'].includes(state)
  const selected = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity }))
  const foodAmount = (order.cafeAvailableItems || []).reduce((sum, item) => sum + item.price * (quantities[item.id] || 0), 0)
  const final = selected.length && takeaway !== undefined ? calculateCafeSelection(order.cafeAvailableItems || [], selected, people, takeaway, Boolean(order.serviceFeeDiscountApplied)) : null
  async function submit(action: string, body: object) {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/orders/${order._id}/cafe-inquiry/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, version: order.cafeOptionsVersion || 0 }) })
      const data = await response.json()
      if (!response.ok) { if (response.status === 409) onUpdated(); throw new Error(data.error || 'Unable to update request') }
      onUpdated()
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.') } finally { setBusy(false) }
  }
  const message = order.status === 'cancelled' ? 'This cafe request was cancelled.' : order.hasPaid && state === 'ready_for_payment' ? 'Your food order is underway.' : cafeStatusLabels[state]
  const mood = order.status === 'cancelled' ? 'warning' : state === 'completed' ? 'success' : order.hasPaid ? 'moving' : state === 'unavailable' ? 'warning' : state === 'awaiting_customer_choice' ? (review ? 'thinking' : 'matched') : state === 'ready_for_payment' ? 'success' : state === 'tasker_assigned' ? 'matched' : 'searching'
  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5 text-slate-900" aria-label="Cafe check">
    <p className="text-xs font-bold uppercase text-indigo-600">Cafe check · {getCafeLabel(order.store)}</p>
    <OrderMascot mood={error ? 'error' : mood} message={message} size="sm" />
    <ol className="flex flex-wrap gap-2 text-xs text-slate-600" aria-label="Cafe request progress">
      <li>✓ Request posted</li>{state !== 'waiting_for_tasker' && <li>✓ Tasker found</li>}{['awaiting_customer_choice', 'ready_for_payment', 'completed'].includes(state) && <li>✓ Options sent</li>}{['ready_for_payment', 'completed'].includes(state) && <li>✓ Food selected</li>}{order.hasPaid && <li>✓ Transfer reported</li>}{state === 'completed' && <li>✓ Delivered</li>}
    </ol>
    {active && state === 'unavailable' && <p className="text-sm">Contact your Tasker to discuss alternatives or use the existing cancellation action. This request remains open.</p>}
    {tasker && active && <p className="text-sm">Go to the cafe and tell the customer what is currently available. Include chargeable takeaway packs as priced options; there is no separate fixed packaging surcharge.</p>}
    {tasker && active && ['tasker_assigned', 'unavailable'].includes(state) && <button className={button} disabled={busy} onClick={() => submit('checking', {})}>I&apos;m at the cafe</button>}
    {tasker && canSend && <div className="space-y-3">
      {rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_7rem] gap-2">
        <input aria-label={`Item ${index + 1} name`} placeholder="Food or pack name" maxLength={100} className={field} value={row.name} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} />
        <input aria-label={`Item ${index + 1} price`} placeholder="Price ₦" type="number" min={1} max={1000000} step={1} className={field} value={row.price} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} />
        <button className="text-left text-sm text-red-700" disabled={busy} onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove item {index + 1}</button>
      </div>)}
      <button className="block text-sm font-semibold text-indigo-700" disabled={rows.length >= 40 || busy} onClick={() => setRows([...rows, { name: '', price: '' }])}>+ Add another item</button>
      <button className={button} disabled={busy || !rows.length} onClick={() => submit('options', { items: rows.map(row => ({ name: row.name, price: Number(row.price) })) })}>Send to customer</button>
      <button className="block text-sm text-slate-600 underline" disabled={busy} onClick={() => submit('options', { unavailable: true })}>Nothing suitable is available</button>
    </div>}
    {!tasker && active && state === 'awaiting_customer_choice' && <div className="space-y-4">
      {!review ? <>{order.cafeAvailableItems?.map(item => <label key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span>{item.name}<span className="block text-sm text-slate-500">{money(item.price)}</span></span><input aria-label={`${item.name} quantity`} className="w-20 rounded-lg border p-2" type="number" min={0} max={20} value={quantities[item.id] || 0} onChange={event => setQuantities({ ...quantities, [item.id]: Math.max(0, Math.min(20, Math.floor(Number(event.target.value) || 0))) })} /></label>)}
        <p className="font-bold">Food and selected packs: {money(foodAmount)}</p>
        <button className={button} disabled={!selected.length} onClick={() => setReview(true)}>Continue to packaging</button></> : <>
        <label className="block">Number of meals<select className={field} value={people} onChange={event => { setPeople(Number(event.target.value)); setTakeaway(undefined) }}>{Array.from({ length: RESTAURANT_MAX_PEOPLE }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
        <label className="block">How many need takeaway packs?<select className={field} value={takeaway ?? ''} onChange={event => setTakeaway(event.target.value === '' ? undefined : Number(event.target.value))}><option value="">Choose packaging</option>{Array.from({ length: people + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'All cellophane' : i === people ? 'All takeaway' : `${i} takeaway, ${people - i} cellophane`}</option>)}</select></label>
        <p className="text-xs">Select any priced packs from the options before continuing. Existing service pricing applies for {people} meal{people === 1 ? '' : 's'}.</p>
        {final && <dl className="space-y-2 text-sm"><div>Food and selected packs: {money(foodAmount)}</div><div>SwiftDU service fee: {money(order.serviceFeeDiscountApplied ? 0 : final.pricing.serviceFee - CAFE_INQUIRY_EXTRA_FEE)}</div><div>Cafe check fee (included once): {money(CAFE_INQUIRY_EXTRA_FEE)}</div><div className="font-bold">Final transfer: {money(final.totalAmount)}</div></dl>}
        <button className="mr-3 text-sm underline" disabled={busy} onClick={() => setReview(false)}>Back to food</button>
        <button className={button} disabled={busy || !final} onClick={() => submit('selection', { items: selected, restaurantPeopleCount: people, restaurantTakeawayCount: takeaway })}>Confirm food and packaging</button>
      </>}
    </div>}
    {order.cafeSelectedItems?.length ? <ul className="text-sm">{order.cafeSelectedItems.map(item => <li key={item.itemId}>{item.quantity} × {item.name} · {money(item.price * item.quantity)}</li>)}</ul> : null}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}
