import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canPayCafeInquiry } from './cafe-inquiry'
import { calculateOrderPricing, CAFE_INQUIRY_EXTRA_FEE } from './pricing'
import { toOrderSocketPayload } from './socket'
import { getTaskerOrderModeFilter } from './test-orders'
import { Order } from '../models/order'

test('new cafe inquiry stores only the existing service charge, with no food amount', () => {
  const pricing = calculateOrderPricing({ taskType: 'restaurant', cafeInquiry: true, amount: 0 })
  assert.equal(pricing.amount, 0)
  assert.equal(pricing.serviceFee, 650)
  assert.equal(pricing.totalAmount, 650)
  assert.equal(CAFE_INQUIRY_EXTRA_FEE, 50)
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1500 }).totalAmount, 2100)
})

test('arrival unlocks the inquiry transfer; legacy ready-for-payment remains payable', () => {
  for (const status of ['waiting_for_tasker', 'tasker_assigned', 'awaiting_customer_choice', 'unavailable', 'completed'] as const) assert.equal(canPayCafeInquiry(status), false)
  assert.equal(canPayCafeInquiry('checking_cafe'), true)
  assert.equal(canPayCafeInquiry('ready_for_payment'), true)
})

test('legacy option fields remain readable and new orders do not acquire them', () => {
  const old = new Order({ userId: 'customer', taskType: 'restaurant', amount: 1500, totalAmount: 1950, commission: 450, location: 'Hostel' })
  assert.equal(old.cafeInquiry, false)
  assert.equal(old.cafeInquiryStatus, undefined)
  const legacy = new Order({ ...old.toObject(), cafeInquiry: true, cafeInquiryStatus: 'awaiting_customer_choice', cafeAvailableItems: [{ id: 'rice', name: 'Rice', price: 200, unit: 'spoon' }], cafeOptionsVersion: 2 })
  assert.equal(legacy.cafeAvailableItems?.[0].unit, 'spoon')
  assert.equal(legacy.cafeOptionsVersion, 2)
})

test('realtime keeps cafe state and training visibility', () => {
  const payload = toOrderSocketPayload({ _id: 'order', userId: 'customer', status: 'in_progress', cafeInquiry: true, cafeInquiryStatus: 'checking_cafe', isTestOrder: true, totalAmount: 650 })
  assert.equal(payload.cafeInquiryStatus, 'checking_cafe')
  assert.equal(payload.isTestOrder, true)
  assert.deepEqual(getTaskerOrderModeFilter({ taskerMode: 'training' }), { isTestOrder: true })
  assert.notDeepEqual(getTaskerOrderModeFilter({ taskerMode: 'live' }), { isTestOrder: true })
})