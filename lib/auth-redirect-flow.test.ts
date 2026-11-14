import assert from 'node:assert/strict'
import test from 'node:test'

import { getPostAuthRedirect, getSafeNextPath, getSignedInDestination } from './profile-completion'

test('role-specific defaults do not loop through home or auth', () => {
  const cases = [
    [{ role: 'user' }, '/dashboard'],
    [{ role: 'tasker' }, '/tasker-dashboard'],
    [{ role: 'admin' }, '/admin'],
    [{ role: 'user', excoRole: 'COO' }, '/admin'],
  ] as const

  for (const [user, destination] of cases) {
    assert.equal(getSignedInDestination(user), destination)
    assert.equal(getPostAuthRedirect(user), destination)
    assert.notEqual(destination, '/')
    assert.notEqual(destination, '/auth')
  }
})

test('intended protected destinations survive auth without creating auth loops', () => {
  assert.equal(getPostAuthRedirect({ role: 'user' }, '/dashboard/tasks?view=active'), '/dashboard/tasks?view=active')
  assert.equal(getPostAuthRedirect({ role: 'tasker' }, '/tasker-dashboard/ORDER_ID'), '/tasker-dashboard/ORDER_ID')
  assert.equal(getPostAuthRedirect({ role: 'admin' }, '/admin/users'), '/admin/users')

  for (const loop of ['/', '/auth', '/login', '/signup', '/complete-profile']) {
    const safe = getSafeNextPath(loop)
    if (loop === '/') assert.equal(safe, '/')
    else assert.equal(safe, null)
  }
  assert.equal(getPostAuthRedirect({ role: 'tasker' }, '/'), '/tasker-dashboard')
  assert.equal(getPostAuthRedirect({ role: 'user' }, '/'), '/dashboard')
  assert.equal(getPostAuthRedirect({ role: 'admin' }, '/'), '/admin')
})
