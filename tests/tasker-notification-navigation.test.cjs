const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')

const read = (path) => readFileSync(path, 'utf8')

test('tasker uses the current order alerts card without a duplicate legacy notification prompt', () => {
  const dashboard = read('components/tasker/TaskerHome.tsx')
  const manager = read('components/PushSubscriptionManager.tsx')
  const layout = read('app/tasker-dashboard/layout.tsx')

  assert.match(dashboard, /<OrderAlertsToggle/)
  assert.match(layout, /<PushSubscriptionManager/)
  assert.match(manager, /return null\s*}/)
  assert.doesNotMatch(manager, /Turn on tasker notifications|Enable notifications<\/button>/)
})

test('order alerts respond optimistically and roll back when permission or server saving fails', () => {
  const toggle = read('components/tasker/OrderAlertsToggle.tsx')
  assert.match(toggle, /setAlertsEnabled\(nextState\)/)
  assert.match(toggle, /await syncPushSubscriptionWithBackend\(true\)/)
  assert.match(toggle, /if \(!subscribed\)/)
  assert.match(toggle, /data\.orderAlertsEnabled !== nextState/)
  assert.match(toggle, /setAlertsEnabled\(previousState\)/)
  assert.match(toggle, /if \(sentPreferenceUpdate\) void fetchPreferences\(\)/)
})

test('customer dashboard offers install action and only taskers get tasker navigation', () => {
  const menu = read('components/dashboard-menu.tsx')
  const landing = read('components/dashboard-landing.tsx')
  const install = read('components/InstallPwaButton.tsx')

  assert.match(landing, /<InstallPwaButton\s*\/>/)
  assert.equal((menu.match(/<InstallPwaButton variant="menu"/g) || []).length, 2)
  assert.match(menu, /href: '\/tasker-dashboard'/)
  assert.match(menu, /session\?\.user\?\.role === 'tasker'/)
  assert.match(install, /if \(isInstalled\) return null/)
})
