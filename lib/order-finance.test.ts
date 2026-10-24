import assert from 'node:assert/strict'
import test from 'node:test'
import { splitServiceFee } from './order-finance'
import { calculateOrderPricing } from './pricing'

test('splits a ₦600 service fee into ₦500 tasker earnings and ₦100 platform fee', () => {
  assert.deepEqual(splitServiceFee(600), {
    serviceFee: 600,
    taskerFee: 500,
    platformFee: 100,
  })
})

test('uses the same one-sixth platform share for other service fees', () => {
  assert.deepEqual(splitServiceFee(900), {
    serviceFee: 900,
    taskerFee: 750,
    platformFee: 150,
  })
})

test('uses the same split for water errands', () => {
  const pricing = calculateOrderPricing({ amount: 0, taskType: 'water', waterBags: 1 })

  assert.equal(pricing.waterFee, 450)
  assert.equal(pricing.platformFee, 75)
  assert.equal(pricing.taskerFee, 375)
})
