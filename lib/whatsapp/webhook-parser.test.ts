import assert from 'node:assert/strict'
import test from 'node:test'

import { parseWhatsAppMessages } from './webhook-parser'

test('parses text and interactive replies without retaining the full payload', () => {
  const messages = parseWhatsAppMessages({ entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: 'Ada' } }],
    messages: [
      { from: '+234 800', id: 'm1', text: { body: 'MENU' } },
      { from: '234800', id: 'm2', interactive: { button_reply: { id: 'menu:order' } } },
    ],
  } }] }] })
  assert.deepEqual(messages, [
    { phone: '234800', messageId: 'm1', text: 'MENU', name: 'Ada' },
    { phone: '234800', messageId: 'm2', text: 'menu:order', name: 'Ada' },
  ])
})
