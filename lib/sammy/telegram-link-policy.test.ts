import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
  isTelegramLinkEligible,
  isValidTelegramLinkToken,
} from './telegram-link-policy'

test('link tokens use 256 random bits and only their hashes need storage', () => {
  const first = createTelegramLinkToken()
  const second = createTelegramLinkToken()
  assert.equal(first.length, 43)
  assert.equal(isValidTelegramLinkToken(first), true)
  assert.notEqual(first, second)
  assert.equal(hashTelegramLinkToken(first).length, 64)
  assert.notEqual(hashTelegramLinkToken(first), first)
})

test('only active admins and EXCO members are eligible to self-link', () => {
  assert.equal(isTelegramLinkEligible({ role: 'admin' }), true)
  assert.equal(isTelegramLinkEligible({ role: 'user', isExco: true }), true)
  assert.equal(isTelegramLinkEligible({ role: 'user' }), false)
  assert.equal(isTelegramLinkEligible({ role: 'tasker' }), false)
  assert.equal(isTelegramLinkEligible({ role: 'admin', isSuspended: true }), false)
  assert.equal(isTelegramLinkEligible({
    role: 'admin',
    telegramRevokedAt: new Date(),
  }), false)
})
