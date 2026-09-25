import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { getTrackingStage, isTaskerSearchExpired, isWaitingForTasker, needsOrderPayment, TASKER_SEARCH_TIMEOUT_MS } from './order-tracking'
import { canCustomerCancelOrder, canTaskerCancelOrder, isActiveOrderStatus } from './order-status'
import { toOrderSocketPayload } from './socket'
import { cafeStatusLabels } from './cafe-inquiry'
import { CafeInquiryPanel } from '../components/cafe-inquiry'
import { FulfillmentStatusCard, getTaskerSearchMessage } from '../app/dashboard/tasks/TasksClient'

const assigned = { _id: 'order-1', userId: 'customer-1', taskerId: 'tasker-1', status: 'in_progress' as const, taskType: 'restaurant', amount: 1000, commission: 650, totalAmount: 1650, description: 'Lunch', location: 'Hostel', createdAt: '2026-09-17T10:00:00Z' }

test('active, paid and completed orders keep their tracking stages', () => {
  assert.equal(getTrackingStage(assigned).label, 'Order accepted')
  assert.equal(getTrackingStage(assigned).title, 'Your order is being fulfilled')
  assert.equal(needsOrderPayment(assigned), true)
  const paid = { ...assigned, status: 'paid', hasPaid: true }
  assert.equal(isActiveOrderStatus(paid.status), true)
  assert.equal(getTrackingStage(paid).label, 'Tasker on the way')
  assert.equal(needsOrderPayment(paid), false)
  assert.equal(getTrackingStage({ ...paid, status: 'completed' }).label, 'Delivered')
  assert.equal(needsOrderPayment({ ...assigned, status: 'completed' }), false)
})

test('Swifty follows assigned and completed order states', () => {
  const matched = renderToStaticMarkup(<FulfillmentStatusCard order={assigned} amount="1,650" statusLabel="Assigned" supportHref={null} />)
  assert.match(matched, /\/mascot\/matched\.png/)
  const completed = renderToStaticMarkup(<FulfillmentStatusCard order={{ ...assigned, status: 'completed' }} amount="1,650" statusLabel="Completed" supportHref={null} />)
  assert.match(completed, /\/mascot\/success\.png/)
})
test('normal and cafe requests use one order-derived waiting state', () => {
  for (const isTestOrder of [false, true]) {
    const pending = { ...assigned, status: 'pending', taskerId: undefined, isTestOrder }
    assert.equal(isWaitingForTasker(pending), true)
    assert.equal(isWaitingForTasker({ ...pending, cafeInquiryStatus: 'waiting_for_tasker' }), true)
    assert.equal(isWaitingForTasker({ ...pending, taskerId: 'tasker-1' }), false)
    assert.equal(isWaitingForTasker({ ...pending, cafeInquiryStatus: 'tasker_assigned' }), false)
    assert.equal(isWaitingForTasker({ ...pending, status: 'cancelled' }), false)
  }
})

test('Swifty search phases change only at the existing elapsed-time boundaries', () => {
  for (const [elapsed, phase] of [
    [0, 0], [59999, 0], [60000, 1], [179999, 1],
    [180000, 2], [299999, 2], [300000, 3], [419999, 3],
  ] as const) assert.equal(getTaskerSearchMessage(elapsed).phase, phase)
  assert.doesNotMatch(getTaskerSearchMessage(300000).detail, /almost there/i)
})
test('waiting requests expire at seven minutes, including cafe and test requests', () => {
  const pending = { ...assigned, status: 'pending', taskerId: undefined }
  const deadline = Date.parse(pending.createdAt) + TASKER_SEARCH_TIMEOUT_MS
  for (const isTestOrder of [false, true]) {
    for (const cafeInquiryStatus of [undefined, 'waiting_for_tasker' as const]) {
      const order = { ...pending, isTestOrder, cafeInquiryStatus }
      assert.equal(isTaskerSearchExpired(order, deadline - 1), false)
      assert.equal(isTaskerSearchExpired(order, deadline), true)
      assert.equal(isTaskerSearchExpired({ ...order, taskerId: 'tasker-1' }, deadline), false)
      assert.equal(isTaskerSearchExpired({ ...order, status: 'cancelled' }, deadline), false)
    }
  }
  assert.equal(isTaskerSearchExpired({ ...pending, createdAt: 'invalid' }, deadline), false)
})
for (const isTestOrder of [false, true]) {
  test(`cancelled socket state overrides assignment and payment history (${isTestOrder ? 'test' : 'live'})`, () => {
    for (const hasPaid of [false, true]) {
      const updated = { ...assigned, ...toOrderSocketPayload({ ...assigned, status: 'cancelled', hasPaid, isTestOrder }) }
      assert.equal(updated.taskerId, assigned.taskerId)
      assert.equal(getTrackingStage(updated).label, 'Cancelled')
      assert.equal(getTrackingStage(updated).detail, 'This order was cancelled.')
      assert.equal(needsOrderPayment(updated), false)
      const html = renderToStaticMarkup(<FulfillmentStatusCard order={{ ...assigned, status: 'cancelled', hasPaid, isTestOrder }} amount="1,650" statusLabel="Cancelled" supportHref={null} />)
      assert.match(html, /This order was cancelled\./)
      assert.doesNotMatch(html, /being fulfilled|Tasker on the way|Order accepted|Stay reachable|animate-spin/)
    }
  })
}

test('every cancelled cafe stage shows cancellation without selection actions or open-request instructions', () => {
  for (const cafeInquiryStatus of Object.keys(cafeStatusLabels) as Array<keyof typeof cafeStatusLabels>) {
    const order = { ...assigned, status: 'cancelled', cafeInquiryStatus }
    assert.equal(getTrackingStage(order).label, 'Cancelled')
    assert.equal(needsOrderPayment(order), false)
    for (const tasker of [false, true]) {
      const html = renderToStaticMarkup(<CafeInquiryPanel order={order} tasker={tasker} onUpdated={() => {}} />)
      assert.match(html, /This cafe request was cancelled\./)
      assert.doesNotMatch(html, /This request remains open|<button|<input|<select/)
    }
  }
})

test('customer and tasker cancellation remain available before payment and blocked for terminal orders', () => {
  for (const canCancel of [canCustomerCancelOrder, canTaskerCancelOrder]) {
    assert.equal(canCancel(assigned), true)
    assert.equal(canCancel({ ...assigned, status: 'pending' }), true)
    assert.equal(canCancel({ ...assigned, hasPaid: true }), false)
    assert.equal(canCancel({ ...assigned, paymentStatus: 'paid' }), false)
    assert.equal(canCancel({ ...assigned, status: 'cancelled' }), false)
    assert.equal(canCancel({ ...assigned, status: 'completed' }), false)
  }
})

test('cafe inquiry uses WhatsApp after arrival without food option controls', () => {
  const order = { ...assigned, cafeInquiry: true, cafeInquiryStatus: 'checking_cafe' as const }
  const customer = renderToStaticMarkup(<CafeInquiryPanel order={order} whatsappHref="https://wa.me/2348000000000" onUpdated={() => {}} />)
  assert.match(customer, /Chat with Tasker on WhatsApp/)
  assert.match(customer, /They’re checking what’s available/)
  const tasker = renderToStaticMarkup(<CafeInquiryPanel order={order} tasker whatsappHref="https://wa.me/2348000000001" onUpdated={() => {}} />)
  assert.match(tasker, /Customer notified/)
  assert.match(tasker, /Chat with Customer on WhatsApp/)
  for (const html of [customer, tasker]) assert.doesNotMatch(html, /Send to customer|Nothing suitable is available|quantity|takeaway|Add another item|Confirm food/)
  assert.equal(needsOrderPayment(order), true)
  assert.equal(needsOrderPayment({ ...order, hasPaid: true }), false)
  assert.equal(getTrackingStage({ ...order, status: 'completed' }).label, 'Completed')
})

test('legacy cafe options remain readable without reopening the old workflow', () => {
  const order = { ...assigned, cafeInquiry: true, cafeInquiryStatus: 'awaiting_customer_choice' as const, cafeAvailableItems: [{ id: 'rice', name: 'Rice', price: 200, unit: 'spoon' }] }
  const html = renderToStaticMarkup(<CafeInquiryPanel order={order} onUpdated={() => {}} />)
  assert.match(html, /Cafe Inquiry/)
  assert.doesNotMatch(html, /Rice|quantity|Confirm food/)
})