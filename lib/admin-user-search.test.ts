import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAdminUserSearch } from './admin-user-search'

function conditions(search: string) {
  return buildAdminUserSearch(search)?.$or || []
}

test('admin user search covers safe profile and account fields', () => {
  const fields = conditions('Ada').flatMap(condition => Object.keys(condition))
  for (const field of ['name', 'email', 'phone', 'location', 'defaultLocation', 'gender', 'role', 'excoRole', 'taskerId']) {
    assert.ok(fields.includes(field), `${field} should be searchable`)
  }
  assert.ok(!fields.includes('password'))
  assert.ok(!fields.includes('firstOrderBonusOrderId'))
})

test('phone search tolerates formatting differences', () => {
  const phoneConditions = conditions('+234 801-234').filter(condition => 'phone' in condition)
  assert.equal(phoneConditions.length, 2)
  assert.deepEqual(phoneConditions[1], { phone: { $regex: '2\\D*3\\D*4\\D*8\\D*0\\D*1\\D*2\\D*3\\D*4' } })
})

test('birthday search understands common numeric and written formats', () => {
  for (const value of ['2000-05-14', '14/05/2000', '14 May 2000', 'May 14, 2000']) {
    const birthdayConditions = conditions(value)
    assert.ok(birthdayConditions.some(condition => 'dateOfBirth' in condition), value)
    assert.ok(birthdayConditions.some(condition => condition.birthdayMonth === 5), value)
    assert.ok(birthdayConditions.some(condition => condition.birthdayDay === 14), value)
  }
  assert.ok(conditions('May').some(condition => condition.birthdayMonth === 5))
})

test('status words and database ids are searchable', () => {
  assert.ok(conditions('verified').some(condition => condition.emailVerified === true))
  assert.ok(conditions('suspended').some(condition => condition.isSuspended === true))
  assert.ok(conditions('active').some(condition => 'isSuspended' in condition))
  assert.ok(conditions('507f1f77bcf86cd799439011').some(condition => '_id' in condition))
})
