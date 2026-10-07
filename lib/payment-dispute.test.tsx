import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire, Module } from 'node:module'
import { NextRequest } from 'next/server'
import { renderToStaticMarkup } from 'react-dom/server'
import { Order } from '../models/order'
import { TaskCard } from '../components/tasker/TaskCards'
import { PaymentReviewActions } from '../components/tasker/PaymentReviewActions'
import { canTaskerCancelOrder, isCustomerPaymentConfirmed } from './order-status'
import { ensureCompletionTimer } from './completion-timer'

test('review actions expose navigation and receipt confirmation, never delivery or cancellation', () => {
  const html = renderToStaticMarkup(<PaymentReviewActions busy={false} onConfirm={async () => true} />)
  assert.match(html, /I have received the payment/)
  assert.match(html, /Check other tasks/)
  assert.match(html, /href="\/tasker-dashboard\?view=all"/)
  assert.doesNotMatch(html, /Order delivered|Cancel task/)
  const order = { status: 'paid', hasPaid: true, paymentStatus: 'paid', isDeclinedTask: true }
  assert.equal(isCustomerPaymentConfirmed(order), false)
  assert.equal(canTaskerCancelOrder(order), false)
  assert.equal(ensureCompletionTimer(order), false)
})

test('existing dispute APIs enforce ownership, freeze review orders and preserve idempotent resolution', async t => {
  const require = createRequire(import.meta.url)
  let user: { id: string; taskerId?: string } | null = { id: 'worker', taskerId: 'tasker' }
  let resolutions = 0, events = 0, saves = 0
  const makeOrder = () => new Order({ userId: 'customer', taskerId: 'tasker', taskType: 'restaurant', location: 'Library', amount: 1000, commission: 200, totalAmount: 1200, status: 'in_progress', hasPaid: false, isDeclinedTask: true, paymentStatus: 'failed', declinedAt: new Date(), declinedReason: 'transaction_not_found', isTestOrder: true })
  let current = makeOrder()
  const stubs: Record<string, unknown> = {
    './db': { connectDB: async () => {} },
    './auth': { auth: { api: { getSession: async () => user ? { user } : null } } },
    '../models/order': { Order: { findById: async () => current } },
    './socket': { emitOrderUpdated: () => { events++ } },
    './payment-dispute': { resolvePaymentDispute: async () => { resolutions++; current.isDeclinedTask = false; current.hasPaid = true; current.paymentStatus = 'paid'; current.paymentDisputeResolution = 'tasker_confirmed_received'; current.paymentDisputeResolvedAt = new Date(); return current } },
    './first-order-bonus': { saveOrderLifecycle: async () => { saves++ }, clearZeroFeeSettlement: () => {}, OrderChangedError: class extends Error {} },
    './tasker-stats': { syncTaskerStats: async () => {} },
    './tasker-settlement': { syncTaskerSettlementStatus: async () => {} },
    './push-notifications': { sendPushNotification: async () => ({}), formatPushTaskType: () => 'food' },
    './service-fee-discount': { consumeServiceFeeDiscountForCompletedOrder: async () => {} },
  }
  for (const [path, exports] of Object.entries(stubs)) {
    const id = require.resolve(path), previous = require.cache[id], stub = new Module(id)
    stub.exports = exports; stub.loaded = true; require.cache[id] = stub
    t.after(() => { if (previous) require.cache[id] = previous; else delete require.cache[id] })
  }
  const { PATCH, DELETE } = require('../app/api/orders/[id]/route')
  const { POST: report } = require('../app/api/orders/[id]/report-transfer-issue/route')
  const params = { params: Promise.resolve({ id: String(current._id) }) }
  const request = (body: unknown, method = 'PATCH') => new NextRequest('http://localhost/api/orders/order', { method, body: JSON.stringify(body) })
  const patch = (body: unknown) => PATCH(request(body), params)
  user = null
  assert.equal((await patch({ clearDeclinedTask: true })).status, 401)
  user = { id: 'customer' }
  assert.equal((await patch({ clearDeclinedTask: true })).status, 403)
  assert.equal((await DELETE(request({}, 'DELETE'), params)).status, 400)
  user = { id: 'other', taskerId: 'other' }
  assert.equal((await patch({ clearDeclinedTask: true })).status, 403)
  user = { id: 'worker', taskerId: 'tasker' }
  for (const body of [{ status: 'completed' }, { status: 'cancelled' }, { status: 'pending' }, { amount: 1 }]) assert.equal((await patch(body)).status, 409)
  assert.equal((await report(request({}, 'POST'), params)).status, 200)
  assert.equal(saves, 0)
  const historical = current.declinedAt!.toISOString()
  assert.equal((await patch({ clearDeclinedTask: true })).status, 200)
  assert.equal(current.declinedAt!.toISOString(), historical)
  assert.equal(current.hasPaid, true)
  // The existing lazy timer repair can save during retries, as in production.
  current.save = async () => current
  assert.equal((await patch({ clearDeclinedTask: true })).status, 200)
  assert.equal(resolutions, 1)
  assert.ok(events >= 1)
  assert.equal((await report(request({}, 'POST'), params)).status, 409)
  assert.equal((await patch({ status: 'completed' })).status, 200)
  assert.equal(current.status, 'completed')
  for (const status of ['completed', 'cancelled'] as const) {
    current = makeOrder(); current.status = status
    assert.equal((await patch({ clearDeclinedTask: true })).status, 409)
  }
})


test('active-task cards retain the disputed order alongside a newer task', () => {
  const base = { taskType: 'restaurant', location: 'Library', status: 'in_progress', createdAt: '2026-10-01T12:00:00Z' }
  const html = renderToStaticMarkup(<>
    <TaskCard active now={0} task={{ ...base, _id: 'disputed', isDeclinedTask: true }} />
    <TaskCard active now={0} task={{ ...base, _id: 'newer', hasPaid: true }} />
  </>)
  assert.match(html, /href="\/tasker-dashboard\/disputed"/)
  assert.match(html, /Transfer under review/)
  assert.match(html, /href="\/tasker-dashboard\/newer"/)
})
