import assert from 'node:assert/strict'
import test from 'node:test'

import { isApprovedTelegramStaffAccount, normalizeCustomerPhone } from './staff-policy'

test('normalizes common Nigerian phone formats to one value', () => {
  assert.equal(normalizeCustomerPhone('0801 234 5678'), '2348012345678')
  assert.equal(normalizeCustomerPhone('+234 801 234 5678'), '2348012345678')
  assert.equal(normalizeCustomerPhone('2348012345678'), '2348012345678')
})

test('approved Telegram staff account can access Sammy', () => {
  assert.equal(isApprovedTelegramStaffAccount({
    telegramUserId: '123456',
    telegramEnabled: true,
    role: 'admin',
  }, '123456'), true)
})

test('unknown or disabled Telegram identities cannot access Sammy', () => {
  assert.equal(isApprovedTelegramStaffAccount(undefined, '123456'), false)
  assert.equal(isApprovedTelegramStaffAccount({
    telegramUserId: '123456',
    telegramEnabled: false,
    role: 'admin',
  }, '123456'), false)
  assert.equal(isApprovedTelegramStaffAccount({
    telegramUserId: '123456',
    telegramEnabled: true,
    role: 'admin',
    isSuspended: true,
  }, '123456'), false)
})
