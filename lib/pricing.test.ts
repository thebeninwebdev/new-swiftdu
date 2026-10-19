import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOrderPricing } from './pricing'

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
