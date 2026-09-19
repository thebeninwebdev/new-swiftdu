'use client'

import { useState } from 'react'
import { OrderMascot } from '@/components/order-mascot'
import { getCafeLabel, cafeStatusLabels, type CafeInquiryFields } from '@/lib/cafe-inquiry'
import { CAFE_INQUIRY_EXTRA_FEE } from '@/lib/pricing'
import { isActiveOrderStatus } from '@/lib/order-status'

const money = (amount: number) => `₦${amount.toLocaleString('en-NG')}`
const button = 'rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50'

export function CafeInquirySelector({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2" aria-label="Restaurant order type">
    {[false, true].map(inquiry => <button type="button" key={String(inquiry)} aria-pressed={value === inquiry} onClick={() => onChange(inquiry)} className={`rounded-2xl border-2 p-4 text-left ${value === inquiry ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>
      <span className="block font-bold">{inquiry ? 'Show me what’s available' : 'I know what I want'}</span>
      <span className="mt-1 block text-sm">{inquiry ? 'A Tasker will visit the cafe and discuss availability with you on WhatsApp.' : 'Tell us your order and food budget.'}</span>
      {inquiry && <span className="mt-2 inline-block rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold">+{money(CAFE_INQUIRY_EXTRA_FEE)} cafe check</span>}
    </button>)}
  </div>
}

export function CafeInquiryReview({ cafe, location, serviceFee, discounted }: { cafe: string; location: string; serviceFee: number; discounted: boolean }) {
  const base = serviceFee - CAFE_INQUIRY_EXTRA_FEE
  return <div className="space-y-3 rounded-2xl border border-indigo-100 bg-white p-5 text-sm text-slate-900">
    <h3 className="text-lg font-bold">Cafe inquiry</h3>
    <p>Your Tasker will visit the cafe and tell you what is available on WhatsApp. Any food purchase is arranged directly with them.</p>
    <dl className="space-y-3">{[['Cafe', cafe], ['Request', 'Check what’s available'], ['Deliver to', location], ['SwiftDU service fee', discounted ? `${money(base)} — waived` : money(base)], ['Cafe check fee', money(CAFE_INQUIRY_EXTRA_FEE)], ['Total inquiry charge', money((discounted ? 0 : base) + CAFE_INQUIRY_EXTRA_FEE)]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}</dl>
    <p className="text-xs text-slate-600">Requesting commits you to this inquiry charge. You will transfer it after the Tasker reaches the cafe. Food and packaging are handled separately on WhatsApp.</p>
  </div>
}

type CafeOrder = CafeInquiryFields & { _id: string; store?: string; status: string; hasPaid?: boolean }
export function CafeInquiryPanel({ order, tasker = false, onUpdated, whatsappHref, onOpenPayment }: { order: CafeOrder; tasker?: boolean; onUpdated: () => void; whatsappHref?: string | null; onOpenPayment?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = order.cafeInquiryStatus
  if (!state) return null
  const active = isActiveOrderStatus(order.status)
  const atCafe = state === 'checking_cafe' || state === 'awaiting_customer_choice' || state === 'unavailable' || state === 'ready_for_payment'
  const message = order.status === 'cancelled' ? 'This cafe request was cancelled.' : order.status === 'completed' ? 'Cafe inquiry completed.' : cafeStatusLabels[state]

  async function markArrival() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${order._id}/cafe-inquiry/checking`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update inquiry')
      onUpdated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
      onUpdated()
    } finally { setBusy(false) }
  }

  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5 text-slate-900" aria-label="Cafe inquiry">
    <p className="text-xs font-bold uppercase text-indigo-600">Cafe Inquiry · {getCafeLabel(order.store)}</p>
    <OrderMascot mood={error ? 'error' : order.status === 'cancelled' ? 'warning' : order.status === 'completed' ? 'success' : atCafe ? 'matched' : 'searching'} message={message} size="sm" />
    {active && tasker && state === 'tasker_assigned' && <button className={button} disabled={busy} onClick={() => void markArrival()}>I&apos;m at the cafe</button>}
    {active && atCafe && <p className="text-sm">{tasker ? 'Customer notified. Continue the cafe inquiry with the customer on WhatsApp.' : `Your Tasker is at ${getCafeLabel(order.store)}. They’re checking what’s available. Continue the conversation with them on WhatsApp.`}</p>}
    {active && atCafe && (whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className={`inline-block ${button}`}>{tasker ? 'Chat with Customer on WhatsApp' : 'Chat with Tasker on WhatsApp'}</a> : <p className="text-sm text-slate-600">WhatsApp contact is not available yet.</p>)}
    {active && atCafe && !tasker && !order.hasPaid && <div className="space-y-2"><p className="text-sm">The inquiry service charge is ready for transfer. Food purchases are arranged separately with your Tasker.</p>{onOpenPayment && <button className={button} onClick={onOpenPayment}>Pay inquiry charge</button>}</div>}
    {active && atCafe && tasker && !order.hasPaid && <p className="text-sm">Complete inquiry becomes available after the customer confirms the inquiry service charge.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}