import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { getTrackingStage, needsOrderPayment } from './order-tracking'
import { canCustomerCancelOrder, canTaskerCancelOrder, isActiveOrderStatus } from './order-status'
import { toOrderSocketPayload } from './socket'
import { cafeStatusLabels } from './cafe-inquiry'
import { CafeInquiryPanel } from '../components/cafe-inquiry'
import { FulfillmentStatusCard } from '../app/dashboard/tasks/TasksClient'

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

test('cafe pricing UI explains units and offers explicit pack pricing', () => {
  const order = { ...assigned, cafeInquiryStatus: 'awaiting_customer_choice' as const, cafeAvailableItems: [{ id: 'rice', name: 'Rice', price: 200, unit: 'spoon' }] }
  const customer = renderToStaticMarkup(<CafeInquiryPanel order={order} onUpdated={() => {}} />)
  assert.match(customer, /₦200 \/ spoon/)
  assert.match(customer, /Rice quantity in spoon/)
  const tasker = renderToStaticMarkup(<CafeInquiryPanel order={order} tasker onUpdated={() => {}} />)
  assert.match(tasker, /Takeaway costs ₦200 per pack/)
  assert.match(tasker, /Add takeaway pack/)
  assert.match(tasker, /Item 1 pricing unit/)
})
