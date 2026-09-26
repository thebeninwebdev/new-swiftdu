import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRestaurantCost, getRestaurantEstimate } from './restaurant-estimate'
import { calculateOrderPricing } from './pricing'

test('the inclusive food estimate becomes the API amount, with service fee added once', () => {
  const estimate = getRestaurantEstimate('4,400')
  assert.equal(estimate.amount, 4400)
  for (const [people, fee] of [[1, 600], [2, 700], [3, 1050]]) {
    const pricing = calculateOrderPricing({ taskType: 'restaurant', amount: estimate.amount, restaurantPeopleCount: people, restaurantTakeawayCount: people })
    assert.equal(pricing.amount, 4400)
    assert.equal(pricing.restaurantPackagingFee, 0)
    assert.equal(pricing.serviceFee, fee)
    assert.equal(pricing.totalAmount, 4400 + fee)
    assert.equal(pricing.totalAmount - pricing.serviceFee, 4400)
  }
})

test('editing replaces the single estimate without adding packaging again', () => {
  assert.equal(getRestaurantEstimate('4000').amount, 4000)
  assert.equal(getRestaurantEstimate('5000').amount, 5000)
})

test('invalid costs are never silently changed into another monetary value', () => {
  for (const value of ['-400', '4.50', 'food', 'Infinity', '1e3', '9007199254740992']) {
    assert.equal(formatRestaurantCost(value), value)
    assert.equal(getRestaurantEstimate(value).valid, false)
  }
  assert.equal(getRestaurantEstimate('').valid, false)
  assert.equal(getRestaurantEstimate('0').valid, false)
  assert.equal(formatRestaurantCost('₦4,000'), '4,000')
})

test('inquiry orders retain unknown food costs and the existing inquiry charge', () => {
  for (const food of ['', '4000']) {
    const estimate = getRestaurantEstimate(food, true)
    assert.equal(estimate.amount, 0)
    assert.equal(estimate.valid, true)
    const pricing = calculateOrderPricing({ taskType: 'restaurant', amount: estimate.amount, cafeInquiry: true })
    assert.equal(pricing.totalAmount, 650)
  }
})
