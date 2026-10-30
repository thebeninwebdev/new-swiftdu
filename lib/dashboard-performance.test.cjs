const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const page = fs.readFileSync('app/dashboard/page.tsx', 'utf8')
const landing = fs.readFileSync('components/dashboard-landing.tsx', 'utf8')
const wizard = fs.readFileSync('components/dashboard-order-wizard.tsx', 'utf8')

test('dashboard renders authenticated landing HTML without a mounted gate', () => {
  assert.doesNotMatch(page, /'use client'/)
  assert.match(page, /<DashboardLanding/)
  assert.doesNotMatch(landing, /if \(!mounted\) return null|setMounted\(|useState\(false\).*mounted/)
  assert.match(landing, /\/mascot\/idle\.webp/)
  assert.match(landing, /fetchPriority="high"/)
  assert.doesNotMatch(landing, /idle\.webm/)
})

test('heavy booking code loads only after a guarded service selection', () => {
  assert.match(landing, /dynamic\(\(\) => import\('@\/components\/dashboard-order-wizard'\)/)
  assert.match(landing, /if \(selectedService\) return <DashboardOrderWizard/)
  assert.match(landing, /!criticalReady \|\| criticalFailed \|\| Boolean\(activeOrder\) \|\| unavailable/)
  assert.doesNotMatch(landing, /\/api\/vendors|\/api\/locations/)
  assert.match(wizard, /\/api\/vendors\?serviceType=/)
  assert.match(wizard, /fetch\('\/api\/locations'/)
})

test('active-order and operations safeguards load in parallel before booking', () => {
  assert.match(landing, /Promise\.all\(\[/)
  assert.match(landing, /\/api\/orders\?current=true/)
  assert.match(landing, /\/api\/operations\/status/)
  assert.match(landing, /acquireSharedSocket/)
  assert.match(page, /initialTrainingMode=/)
  assert.match(landing, /isCustomerOrderingUnavailable\(operations, trainingMode\)/)
  assert.match(landing, /swiftdu-exco-order-mode-changed/)
})

test('service-specific modules and authenticated analytics are deferred', () => {
  assert.match(wizard, /dynamic\(\(\) => import\('@\/components\/indomie\/IndomieFlow'\)/)
  assert.match(wizard, /dynamic\(\(\) => import\('@\/components\/cafe-inquiry'\)/)
  const scripts = fs.readFileSync('components/DeferredAppScripts.tsx', 'utf8')
  assert.match(scripts, /authenticatedRoute \? 8000 : 0/)
  assert.match(scripts, /!authenticatedRoute \? <DeferredAdsenseLoader/)
})
