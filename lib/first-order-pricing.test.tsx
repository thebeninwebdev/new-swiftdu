import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { calculateOrderPricing } from './pricing'
import { canReleaseFirstOrderReservation, priceWithOrderDiscounts } from './first-order-pricing'
import { taskerEarnings } from './tasker-work'
import { FirstOrderBonusNotice, FirstOrderPriceBreakdown } from '../components/first-order-bonus'

test('first orders remit none of the applicable service fee to the platform', () => {
  const inputs = [
    { taskType: 'restaurant', amount: 2000, restaurantPeopleCount: 3 },
    { taskType: 'restaurant', amount: 0, cafeInquiry: true },
    { taskType: 'shopping', amount: 5000, store: 'rita' },
    { taskType: 'printing', amount: 0, numberOfPages: 20, printingServiceType: 'printing' },
    { taskType: 'water', amount: 0, waterBags: 3 },
    { taskType: 'copy_notes', amount: 0, noteSize: 'big', numberOfPages: 30 },
    { taskType: 'indomie', amount: 4000, indomiePacks: 3, eggCount: 2 },
    { taskType: 'dry_cleaning', amount: 4000 },
  ]
  for (const input of inputs) {
    const normal = calculateOrderPricing(input)
    const fees = priceWithOrderDiscounts(normal)
    const bonus = priceWithOrderDiscounts(normal, { firstOrderBonus: true, cafeInquiry: input.cafeInquiry })
    assert.equal(bonus.taskerFee, fees.taskerFee)
    assert.equal(taskerEarnings(bonus), fees.taskerFee)
    assert.equal(bonus.platformFee, 0)
    assert.equal(bonus.totalAmount, fees.totalAmount - fees.platformFee)
    assert.equal(bonus.serviceFee, fees.serviceFee - fees.platformFee)
    assert.equal(bonus.commission, bonus.serviceFee)
    assert.equal(bonus.totalAmount, Math.max(0, fees.totalAmount - fees.platformFee))
    assert.equal(bonus.firstOrderBonusAmount, fees.platformFee)
    assert.equal(bonus.platformFeeBeforeFirstOrderBonus, fees.platformFee)
  }
})

test('repricing from normal pricing never subtracts twice', () => {
  let order: ReturnType<typeof priceWithOrderDiscounts> = { ...calculateOrderPricing({ taskType: 'restaurant', amount: 2000 }), ...priceWithOrderDiscounts(calculateOrderPricing({ taskType: 'restaurant', amount: 2000 }), { firstOrderBonus: true }) }
  const normal = calculateOrderPricing({ taskType: 'restaurant', amount: 2500, restaurantPeopleCount: 4, restaurantTakeawayCount: 3 })
  for (let i = 0; i < 5; i++) {
    order = { ...order, ...normal, ...priceWithOrderDiscounts(normal, { firstOrderBonus: true }) }
    assert.equal(order.totalAmount, normal.totalAmount - priceWithOrderDiscounts(normal).platformFee)
  }
})

test('broader discount is applied first and retained cafe charge is not waived wholesale', () => {
  for (const cafeInquiry of [false, true]) {
    const normal = calculateOrderPricing({ taskType: 'restaurant', amount: cafeInquiry ? 0 : 2000, cafeInquiry })
    const broader = priceWithOrderDiscounts(normal, { serviceFeeDiscount: true, cafeInquiry })
    const both = priceWithOrderDiscounts(normal, { firstOrderBonus: true, serviceFeeDiscount: true, cafeInquiry })
    assert.equal(both.taskerFee, broader.taskerFee)
    assert.equal(both.platformFee, 0)
    assert.equal(both.totalAmount, broader.totalAmount - broader.platformFee)
    assert.ok(both.totalAmount >= 0)
    if (!cafeInquiry) assert.equal(both.firstOrderBonusAmount, 0)
    else { assert.ok(both.totalAmount > 0); assert.equal(both.firstOrderBonusAmount, broader.platformFee) }
  }
})

test('a ₦600 fee gives the customer a ₦100 first-order discount without changing tasker earnings', () => {
  const normal = { amount: 2000, serviceFee: 600, totalAmount: 2600, pricingModel: 'tiered' as const, waterFee: 0 }
  const fees = priceWithOrderDiscounts(normal)
  const bonus = priceWithOrderDiscounts(normal, { firstOrderBonus: true })
  assert.deepEqual(fees, { commission: 600, serviceFee: 600, taskerFee: 500, platformFee: 100, totalAmount: 2600, firstOrderBonusApplied: false, platformFeeBeforeFirstOrderBonus: undefined, firstOrderBonusAmount: undefined })
  assert.equal(bonus.serviceFee, 500)
  assert.equal(bonus.taskerFee, 500)
  assert.equal(bonus.platformFee, 0)
  assert.equal(bonus.firstOrderBonusAmount, 100)
  assert.equal(bonus.platformFeeBeforeFirstOrderBonus, 100)
  assert.equal(bonus.totalAmount, 2500)
  assert.equal(taskerEarnings(bonus), 500)
})

test('vendor-specific tiered fees waive the actual platform share, not a fixed amount', () => {
  const pricing = { amount: 2000, serviceFee: 900, totalAmount: 2900, pricingModel: 'tiered' as const, waterFee: 0 }
  const bonus = priceWithOrderDiscounts(pricing, { firstOrderBonus: true })
  assert.equal(bonus.serviceFee, 750)
  assert.equal(bonus.taskerFee, 750)
  assert.equal(bonus.platformFee, 0)
  assert.equal(bonus.firstOrderBonusAmount, 150)
  assert.equal(bonus.totalAmount, 2750)
})

test('only genuinely unpaid cancelled orders release reservations', () => {
  assert.equal(canReleaseFirstOrderReservation({ status: 'cancelled', paymentStatus: 'cancelled' }), true)
  for (const patch of [{ status: 'pending' }, { isTestOrder: true }, { hasPaid: true }, { paymentStatus: 'paid' }, { cafeInquiryFeePaid: true }, { customerTransferredAt: new Date() }, { paidAt: new Date() }]) {
    assert.equal(canReleaseFirstOrderReservation({ status: 'cancelled', ...patch }), false)
  }
})

test('breakdowns show one service fee without exposing settlement shares', () => {
  const normal = calculateOrderPricing({ taskType: 'water', amount: 0, waterBags: 2 })
  const order = { ...normal, ...priceWithOrderDiscounts(normal, { firstOrderBonus: true }) }
  const html = renderToStaticMarkup(<FirstOrderPriceBreakdown order={order} />)
  assert.match(html, /Service fee/)
  assert.doesNotMatch(html, /<s>/)
  assert.doesNotMatch(html, /Tasker fee|platform fee/i)
  assert.match(html, /dark:/)
  assert.doesNotMatch(html, /Paystack|reimburse/)
  assert.equal(renderToStaticMarkup(<FirstOrderBonusNotice order={order} tasker />), '')
  assert.equal(renderToStaticMarkup(<FirstOrderPriceBreakdown order={{ ...order, firstOrderBonusApplied: false }} />), '')
})
