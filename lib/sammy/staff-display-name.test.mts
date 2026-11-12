import assert from 'node:assert/strict'
import test from 'node:test'

const { getSammyStaffFirstName } = await import('./staff-display-name')

test('prefers linked SwiftDU staff account name over Telegram nickname', () => {
  assert.equal(getSammyStaffFirstName({ name: 'Eseosa Osayi', telegramFirstName: 'Nik' }), 'Eseosa')
  assert.equal(getSammyStaffFirstName({ name: '  Eseosa   Osayi  ', telegramFirstName: 'Nik' }), 'Eseosa')
})

test('falls back to Telegram name, then a safe generic greeting', () => {
  assert.equal(getSammyStaffFirstName({ name: '', telegramFirstName: 'Nikki' }), 'Nikki')
  assert.equal(getSammyStaffFirstName({ name: undefined, telegramFirstName: '  Alex  West ' }), 'Alex')
  assert.equal(getSammyStaffFirstName({ name: null, telegramFirstName: null }), 'Staff')
})
