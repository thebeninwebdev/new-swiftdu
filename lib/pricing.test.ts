import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOrderPricing } from './pricing'

test('Sarah and Mummy V shopping orders include the distance fee at every budget tier', () => {
  for (const amount of [1000, 5000, 7000, 10000]) {
    const standard = calculateOrderPricing({ taskType: 'shopping', store: 'rita', amount })
    for (const store of ['sarah', 'muuy V', 'mummy v']) {
      const pricing = calculateOrderPricing({ taskType: 'shopping', store, amount })
      assert.equal(pricing.amount, amount)
      assert.equal(pricing.serviceFee, standard.serviceFee + 200)
      assert.equal(pricing.totalAmount, standard.totalAmount + 200)
    }
  }
})

test('other stores and non-shopping orders have no distance surcharge', () => {
  for (const store of ['rita', '', undefined]) {
    assert.equal(calculateOrderPricing({ taskType: 'shopping', store, amount: 1000 }).totalAmount, 1450)
  }
  assert.equal(calculateOrderPricing({ taskType: 'restaurant', store: 'sarah', amount: 1000 }).totalAmount, 1600)
})
