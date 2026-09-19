import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateCafeSelection, validateCafeOptions } from './cafe-inquiry'
import { calculateOrderPricing, calculateRestaurantPackagingFee, RESTAURANT_TAKEAWAY_PACK_PRICE } from './pricing'
import { toOrderSocketPayload } from './socket'
import { Order } from '../models/order'

const options = [{ id: 'rice', name: 'Jollof rice', price: 1500 }, { id: 'chicken', name: 'Chicken', price: 1200 }]
test('initial request commits exactly 600 + 50, with no food', () => {
  const pricing = calculateOrderPricing({ taskType: 'restaurant', cafeInquiry: true, amount: 0 })
  assert.equal(pricing.amount, 0)
  assert.equal(pricing.serviceFee, 650)
  assert.equal(pricing.totalAmount, 650)
})
test('selection ignores forged prices and charges the check fee once', () => {
  const result = calculateCafeSelection(options, [{ itemId: 'rice', quantity: 2, price: 1 }, { itemId: 'chicken', quantity: 1, price: -99 }], 1, 1, false)
  assert.equal(result.pricing.amount, 4200)
  assert.equal(result.totalAmount, 4850)
  assert.equal(result.selected[0].price, 1500)
})
test('discount waives normal service only and retains the 50 check fee', () => {
  const result = calculateCafeSelection(options, [{ itemId: 'rice', quantity: 1 }], 1, 0, true)
  assert.equal(result.totalAmount, 1550)
})
test('multiple meals preserve existing service and mixed packaging rules', () => {
  const result = calculateCafeSelection(options, [{ itemId: 'rice', quantity: 3 }], 3, 2, false)
  assert.equal(result.pricing.serviceFee, 1100)
  assert.equal(result.totalAmount, 5600)
  assert.equal(result.packaging, '2 takeaway, 1 cellophane')
  assert.equal(result.pricing.restaurantPackagingFee, calculateRestaurantPackagingFee(2, 3))
})
test('rejects unknown, duplicate and empty selections', () => {
  for (const items of [[], [{ itemId: 'forged', quantity: 1 }], [{ itemId: 'rice', quantity: 1 }, { itemId: 'rice', quantity: 1 }], [null]]) {
    assert.throws(() => calculateCafeSelection(options, items, 1, 0, false))
  }
})
test('rejects invalid quantities and packaging', () => {
  for (const quantity of [-1, 0, 1.5, 21, Infinity, '2']) assert.throws(() => calculateCafeSelection(options, [{ itemId: 'rice', quantity }], 1, 0, false))
  for (const [people, takeaway] of [[0, 0], [4, 0], [1, 2], [2, -1], [2, 0.5], ['1', 0], [1, undefined]]) assert.throws(() => calculateCafeSelection(options, [{ itemId: 'rice', quantity: 1 }], people, takeaway, false))
})
test('options require usable names and positive bounded whole-naira prices', () => {
  assert.deepEqual(validateCafeOptions([{ name: ' Rice ', price: 1500 }]), [{ name: 'Rice', price: 1500 }])
  for (const item of [null, { name: '', price: 5 }, { name: 'x'.repeat(101), price: 5 }, ...[-1, 0, NaN, Infinity, 1.5, '500', 1000001].map(price => ({ name: 'Rice', price }))]) assert.throws(() => validateCafeOptions([item]))
  assert.throws(() => validateCafeOptions([]))
  assert.throws(() => validateCafeOptions(Array(41).fill({ name: 'Rice', price: 500 })))
})
test('normal restaurant and other categories retain their pricing paths', () => {
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1500 }).totalAmount, 2100)
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1500, restaurantPeopleCount: 2 }).totalAmount, 2200)
  assert.equal(calculateOrderPricing({ taskType: 'shopping', amount: 1500 }).totalAmount, 1950)
  assert.equal(calculateOrderPricing({ taskType: 'water', amount: 0, waterBags: 2 }).totalAmount, 2400)
  assert.equal(calculateOrderPricing({ taskType: 'indomie', amount: 1500 }).totalAmount, 1950)
  assert.equal(calculateOrderPricing({ taskType: 'printing', amount: 0, printingServiceType: 'printing', numberOfPages: 2 }).totalAmount, 700)
  assert.equal(calculateOrderPricing({ taskType: 'copy_notes', amount: 0, noteSize: 'small', numberOfPages: 3 }).totalAmount, 500)
})
test('legacy orders do not acquire inquiry states; new fields survive schema casting', () => {
  const old = new Order({ userId: 'customer', taskType: 'restaurant', amount: 1500, totalAmount: 1950, commission: 450, location: 'Hostel' })
  assert.equal(old.cafeInquiry, false)
  assert.equal(old.cafeInquiryStatus, undefined)
  assert.deepEqual(Array.from(old.cafeAvailableItems || []), [])
  const current = new Order({ ...old.toObject(), cafeInquiry: true, cafeInquiryStatus: 'awaiting_customer_choice', cafeAvailableItems: options, cafeOptionsVersion: 2 })
  assert.equal(current.cafeAvailableItems?.[0].id, 'rice')
  assert.equal(current.cafeOptionsVersion, 2)
})
test('realtime includes saved options, state, prices and training visibility', () => {
  const payload = toOrderSocketPayload({ _id: 'order', userId: 'customer', status: 'in_progress', cafeInquiry: true, cafeInquiryStatus: 'awaiting_customer_choice', cafeAvailableItems: options, cafeOptionsVersion: 2, isTestOrder: true, totalAmount: 650 })
  assert.deepEqual(payload.cafeAvailableItems, options)
  assert.equal(payload.cafeOptionsVersion, 2)
  assert.equal(payload.isTestOrder, true)
  assert.equal(payload.totalAmount, 650)
})

test('unit prices survive validation, schema casting and server-authoritative selection', () => {
  const items = validateCafeOptions([{ name: 'Rice', price: 200, unit: ' spoon ' }])
  assert.equal(items[0].unit, 'spoon')
  for (const unit of [123, null, 'x'.repeat(31)]) assert.throws(() => validateCafeOptions([{ name: 'Rice', price: 200, unit }]))
  const available = [{ id: 'rice', ...items[0] }, { id: 'pack', name: 'Takeaway pack', price: RESTAURANT_TAKEAWAY_PACK_PRICE, unit: 'pack' }]
  const result = calculateCafeSelection(available, [{ itemId: 'rice', quantity: 3, unit: 'bowl', price: 1 }, { itemId: 'pack', quantity: 2 }], 1, 1, false)
  assert.equal(result.selected[0].unit, 'spoon')
  assert.equal(result.pricing.amount, 1000)
  assert.equal(result.totalAmount, 1650)
  assert.equal(result.pricing.restaurantPackagingFee, 0)
  const withoutPacks = calculateCafeSelection(available, [{ itemId: 'rice', quantity: 3 }], 1, 1, false)
  assert.equal(withoutPacks.pricing.amount, 600)
  const saved = new Order({ cafeAvailableItems: available, cafeSelectedItems: result.selected })
  assert.equal(saved.cafeAvailableItems?.[0].unit, 'spoon')
  assert.equal(saved.cafeSelectedItems?.[0].unit, 'spoon')
})
