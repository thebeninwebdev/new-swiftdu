import assert from 'node:assert/strict'
import test from 'node:test'

import { isPushSetupComplete, type PushSetupState } from '../components/PushSubscriptionManager'

const complete: PushSetupState = {
  supported: true,
  permission: 'granted',
  hasBrowserSubscription: true,
  hasBackendSubscription: true,
}

test('notification onboarding hides only when preference and both subscriptions agree', () => {
  assert.equal(isPushSetupComplete(true, complete), true)
  assert.equal(isPushSetupComplete(false, complete), false)
  assert.equal(isPushSetupComplete(true, { ...complete, permission: 'denied' }), false)
  assert.equal(isPushSetupComplete(true, { ...complete, hasBrowserSubscription: false }), false)
  assert.equal(isPushSetupComplete(true, { ...complete, hasBackendSubscription: false }), false)
})
