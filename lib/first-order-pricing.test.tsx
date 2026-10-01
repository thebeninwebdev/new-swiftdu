import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { calculateOrderPricing, CAFE_INQUIRY_EXTRA_FEE } from './pricing'
import { canReleaseFirstOrderReservation, priceWithOrderDiscounts } from './first-order-pricing'
import { taskerEarnings } from './tasker-work'
import { FirstOrderBonusNotice, FirstOrderPriceBreakdown } from '../components/first-order-bonus'

test('bonus removes only actual platform share across every pricing model', () => {
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
    assert.equal(taskerEarnings(bonus), taskerEarnings(fees))
    assert.equal(bonus.platformFee, 0)
    assert.equal(bonus.totalAmount, fees.totalAmount - fees.platformFee)
    assert.equal(bonus.serviceFee, fees.serviceFee - fees.platformFee)
    assert.equal(bonus.commission, bonus.serviceFee)
    assert.equal(normal.amount + bonus.commission, bonus.totalAmount)
    assert.equal(bonus.firstOrderBonusAmount, fees.platformFee)
    assert.equal(bonus.platformFeeBeforeFirstOrderBonus, fees.platformFee)
  }
})

test('repricing from normal pricing never subtracts twice', () => {
  let order = { ...calculateOrderPricing({ taskType: 'restaurant', amount: 2000 }), ...priceWithOrderDiscounts(calculateOrderPricing({ taskType: 'restaurant', amount: 2000 }), { firstOrderBonus: true }) }
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
    assert.equal(both.totalAmount, broader.totalAmount - (both.firstOrderBonusAmount || 0))
    assert.ok(both.totalAmount >= 0)
    if (!cafeInquiry) assert.equal(both.firstOrderBonusAmount, 0)
    else { assert.ok(both.totalAmount > 0); assert.ok(both.firstOrderBonusAmount! < CAFE_INQUIRY_EXTRA_FEE) }
  }
})

test('only genuinely unpaid cancelled orders release reservations', () => {
  assert.equal(canReleaseFirstOrderReservation({ status: 'cancelled', paymentStatus: 'cancelled' }), true)
  for (const patch of [{ status: 'pending' }, { isTestOrder: true }, { hasPaid: true }, { paymentStatus: 'paid' }, { cafeInquiryFeePaid: true }, { customerTransferredAt: new Date() }, { paidAt: new Date() }]) {
    assert.equal(canReleaseFirstOrderReservation({ status: 'cancelled', ...patch }), false)
  }
})

test('breakdowns display the saved total, full tasker fee, and honest waiver copy', () => {
  const normal = calculateOrderPricing({ taskType: 'water', amount: 0, waterBags: 2 })
  const order = { ...normal, ...priceWithOrderDiscounts(normal, { firstOrderBonus: true }) }
  const html = renderToStaticMarkup(<FirstOrderPriceBreakdown order={order} />)
  assert.match(html, /Items\/service cost/)
  assert.match(html, /Tasker fee/)
  assert.match(html, /SwiftDU platform fee/)
  assert.match(html, /First-order bonus/)
  assert.match(html, /dark:/)
  assert.doesNotMatch(html, /Paystack|reimburse/)
  assert.match(renderToStaticMarkup(<FirstOrderBonusNotice order={order} tasker />), /no platform fee to remit/)
  assert.equal(renderToStaticMarkup(<FirstOrderPriceBreakdown order={{ ...order, firstOrderBonusApplied: false }} />), '')
})
