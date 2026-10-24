import assert from 'node:assert/strict'
import test from 'node:test'
import { getTelegramTrainingOrdersChatId } from './telegram'

const trainingChatId = process.env.TELEGRAM_TRAINING_ORDERS_CHAT_ID

test.after(() => {
  if (trainingChatId === undefined) {
    delete process.env.TELEGRAM_TRAINING_ORDERS_CHAT_ID
  } else {
    process.env.TELEGRAM_TRAINING_ORDERS_CHAT_ID = trainingChatId
  }
})

test('uses the configured training order Telegram chat ID', () => {
  process.env.TELEGRAM_TRAINING_ORDERS_CHAT_ID = '  -1001234567890  '

  assert.equal(getTelegramTrainingOrdersChatId(), '-1001234567890')
})

test('does not substitute a hard-coded chat when training Telegram is unconfigured', () => {
  delete process.env.TELEGRAM_TRAINING_ORDERS_CHAT_ID

  assert.equal(getTelegramTrainingOrdersChatId(), undefined)
})
