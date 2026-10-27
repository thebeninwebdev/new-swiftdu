import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isTelegramMessagingDisabledInDevelopment, sendTelegramMessage } from './telegram'

test('Telegram messaging is disabled only for an explicit development environment', () => {
  assert.equal(isTelegramMessagingDisabledInDevelopment('development', undefined), true)
  assert.equal(isTelegramMessagingDisabledInDevelopment('production', 'development'), true)
  assert.equal(isTelegramMessagingDisabledInDevelopment('production', 'production'), false)
  assert.equal(isTelegramMessagingDisabledInDevelopment('test', undefined), false)
})

test('development never calls the Telegram sendMessage API', async t => {
  const previousVercelEnv = process.env.VERCEL_ENV
  const previousToken = process.env.TELEGRAM_BOT_TOKEN
  const previousChat = process.env.TELEGRAM_CHAT_ID
  process.env.VERCEL_ENV = 'development'
  process.env.TELEGRAM_BOT_TOKEN = 'configured-token'
  process.env.TELEGRAM_CHAT_ID = 'configured-chat'
  t.after(() => {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousVercelEnv
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = previousToken
    if (previousChat === undefined) delete process.env.TELEGRAM_CHAT_ID
    else process.env.TELEGRAM_CHAT_ID = previousChat
  })
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('development must not contact Telegram sendMessage')
  })

  assert.equal(await sendTelegramMessage('must not send'), false)
})
