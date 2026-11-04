import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOrderPricing, getShoppingBasketSurcharge } from './pricing'

test('restaurant delivery adds ₦200 for each additional person, capped at three', () => {
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1000, restaurantPeopleCount: 1, serviceFee: 600 }).serviceFee, 600)
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1000, restaurantPeopleCount: 2, serviceFee: 600 }).serviceFee, 800)
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1000, restaurantPeopleCount: 3, serviceFee: 600 }).serviceFee, 1000)
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', amount: 1000, restaurantPeopleCount: 9, serviceFee: 600 }).serviceFee, 1000)
})

test('printing keeps the page price separate from an injected delivery fee', () => {
  const pricing = calculateOrderPricing({ taskType: 'printing', printingServiceType: 'printing', numberOfPages: 7, amount: 0, serviceFee: 900 })
  assert.equal(pricing.amount, 700)
  assert.equal(pricing.serviceFee, 900)
  assert.equal(pricing.totalAmount, 1600)
})

test('standard delivery tasks have no hidden fee when no quote is supplied', () => {
  const pricing = calculateOrderPricing({ taskType: 'shopping', store: 'mummy v', amount: 1000 })
  assert.equal(pricing.amount, 1000)
  assert.equal(pricing.serviceFee, 0)
  assert.equal(pricing.totalAmount, 1000)
})

test('shopping basket surcharge uses the configured inclusive tier boundaries', () => {
  for (const [amount, expectedSurcharge] of [
    [0, 0], [1, 0], [4_999, 0], [5_000, 0], [5_001, 100],
    [9_000, 100], [10_000, 100], [10_001, 200], [15_000, 200],
    [15_001, 300], [20_000, 300], [20_001, 500], [30_000, 500],
    [30_001, 700], [100_000, 700],
  ]) {
    assert.equal(getShoppingBasketSurcharge(amount), expectedSurcharge, `amount ${amount}`)
  }
})

test('shopping pricing adds the basket surcharge to the configured delivery fee', () => {
  const nineThousandBasket = calculateOrderPricing({ taskType: 'shopping', amount: 9_000, serviceFee: 600 })
  assert.equal(nineThousandBasket.amount, 9_000)
  assert.equal(nineThousandBasket.serviceFee, 700)
  assert.equal(nineThousandBasket.totalAmount, 9_700)

  const fourteenThousandBasket = calculateOrderPricing({ taskType: 'shopping', amount: 14_000, serviceFee: 900 })
  assert.equal(fourteenThousandBasket.serviceFee, 1_100)
  assert.equal(fourteenThousandBasket.totalAmount, 15_100)
})

test('non-shopping pricing does not receive a shopping basket surcharge', () => {
  const pricing = calculateOrderPricing({ taskType: 'restaurant', amount: 9_000, serviceFee: 600 })
  assert.equal(pricing.serviceFee, 600)
  assert.equal(pricing.totalAmount, 9_600)
})

test('cafe inquiry service fee follows the 1–3 order schedule', () => {
  for (const [orders, fee] of [[1, 650], [2, 850], [3, 1050]] as const) {
    const pricing = calculateOrderPricing({
      taskType: 'restaurant',
      amount: 0,
      cafeInquiry: true,
      restaurantPeopleCount: orders,
      restaurantTakeawayCount: 0,
      serviceFee: 600,
    })
    assert.equal(pricing.serviceFee, fee)
    assert.equal(pricing.totalAmount, fee)
  }
})