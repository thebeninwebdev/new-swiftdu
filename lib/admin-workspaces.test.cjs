const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const ts = require('typescript')
const vm = require('node:vm')

const source = fs.readFileSync('lib/admin-workspaces.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
vm.runInNewContext(compiled, {
  exports: exportsObject,
  module: { exports: exportsObject },
  require,
  URLSearchParams,
})

const {
  buildAdminWorkspaceTabHref,
  getAdminOrderStatusQuery,
  isLatestAdminOrderRequest,
  resolveAdminWorkspaceTab,
} = exportsObject

test('/admin/orders defaults to Live and invalid Orders tabs safely resolve to Live', () => {
  assert.equal(resolveAdminWorkspaceTab('orders', null), 'live')
  assert.equal(resolveAdminWorkspaceTab('orders', 'live'), 'live')
  assert.equal(resolveAdminWorkspaceTab('orders', 'not-a-tab'), 'live')
})

test('direct Reviews and Indomie Batches URLs resolve to their requested content', () => {
  assert.equal(resolveAdminWorkspaceTab('orders', 'reviews'), 'reviews')
  assert.equal(resolveAdminWorkspaceTab('orders', 'batches'), 'batches')
})

test('browser back and forward URL snapshots always resolve matching Orders content', () => {
  const history = ['live', 'all', 'reviews', 'all', 'live']
  assert.deepEqual(
    Array.from(history, (tab) => resolveAdminWorkspaceTab('orders', tab)),
    history
  )
})

test('Live requests pending, in_progress and paid but never completed or cancelled', () => {
  const query = getAdminOrderStatusQuery('live', 'all')
  assert.equal(query, 'pending,in_progress,paid')
  assert.equal(query.includes('completed'), false)
  assert.equal(query.includes('cancelled'), false)
})

test('All Orders requests all statuses and Paid remains directly filterable', () => {
  assert.equal(getAdminOrderStatusQuery('all', 'all'), 'all')
  assert.equal(getAdminOrderStatusQuery('all', 'paid'), 'paid')
})

test('switching scopes immediately derives the new query instead of retaining the previous scope', () => {
  assert.equal(getAdminOrderStatusQuery('all', 'all'), 'all')
  assert.equal(getAdminOrderStatusQuery('live', 'all'), 'pending,in_progress,paid')
  assert.equal(getAdminOrderStatusQuery('live', 'completed'), 'pending,in_progress,paid')
})

test('only the latest order request may apply its response', () => {
  assert.equal(isLatestAdminOrderRequest(1, 2), false)
  assert.equal(isLatestAdminOrderRequest(2, 2), true)
})

test('workspace tab URLs preserve supported query parameters and reset explicit tab-local ones', () => {
  assert.equal(
    buildAdminWorkspaceTabHref({ pathname: '/admin/orders', search: 'tab=live&declined=only&utm_source=ops', tab: 'all' }),
    '/admin/orders?tab=all&declined=only&utm_source=ops'
  )
  assert.equal(
    buildAdminWorkspaceTabHref({ pathname: '/admin/orders', search: 'tab=all&declined=only&utm_source=ops', tab: 'reviews', reset: ['declined'] }),
    '/admin/orders?tab=reviews&utm_source=ops'
  )
})

test('People, Marketplace and Operations resolve direct and invalid tab URLs consistently', () => {
  assert.equal(resolveAdminWorkspaceTab('people', 'customers'), 'customers')
  assert.equal(resolveAdminWorkspaceTab('people', 'bad'), 'taskers')
  assert.equal(resolveAdminWorkspaceTab('marketplace', 'pricing'), 'pricing')
  assert.equal(resolveAdminWorkspaceTab('marketplace', 'bad'), 'businesses')
  assert.equal(resolveAdminWorkspaceTab('operations', 'finance'), 'finance')
  assert.equal(resolveAdminWorkspaceTab('operations', 'bad'), 'availability')
})

test('Orders scope changes reset page, expanded content, stale rows and status state', () => {
  const page = fs.readFileSync('app/admin/orders/page.tsx', 'utf8')
  const scopeEffect = page.slice(page.indexOf('if (filterScope === scope) return'), page.indexOf('useEffect(() => {', page.indexOf('if (filterScope === scope) return') + 1))
  assert.match(scopeEffect, /setStatusFilter\('all'\)/)
  assert.match(scopeEffect, /setCurrentPage\(1\)/)
  assert.match(scopeEffect, /setExpandedId\(null\)/)
  assert.match(scopeEffect, /setOrders\(\[\]\)/)
})

test('Orders workspace wiring covers reviews, real batch monitoring, pagination reset and active-query refresh', () => {
  const page = fs.readFileSync('app/admin/orders/page.tsx', 'utf8')
  assert.match(page, /tab === 'reviews' \? <AdminReviewsContent embedded \/>/)
  assert.match(page, /return <AdminIndomieBatches \/>/)
  assert.match(page, /setCurrentPage\(1\)/)
  assert.match(page, /setOrders\(\[\]\)/)
  assert.match(page, /AbortController/)
  assert.match(page, /await fetchOrders\(\)/)
  assert.match(page, /<SelectItem value="paid">Paid<\/SelectItem>/)
})

test('Orders API retains active-session filtering and validates server-side live statuses', () => {
  const route = fs.readFileSync('app/api/admin/orders/route.ts', 'utf8')
  assert.match(route, /AcademicSession\.findOne\(\{ isActive: true \}\)/)
  assert.match(route, /\$gte: currentSession\.startDate/)
  assert.match(route, /\$lte: currentSession\.endDate/)
  assert.match(route, /filters\.status = \{ \$in: liveStatuses \}/)
  assert.match(route, /isAdminOrderStatus\(status\)/)
  assert.match(route, /Cache-Control': 'no-store'/)
})

test('batch monitoring reads persisted batches and order batching fields without changing batching', () => {
  const route = fs.readFileSync('app/api/admin/orders/route.ts', 'utf8')
  const component = fs.readFileSync('components/admin-indomie-batches.tsx', 'utf8')
  assert.match(route, /IndomieBatch\.find/)
  assert.match(route, /batchId batchStatus batchingStatus batchWindowStart batchWindowEnd indomieRunAt/)
  assert.match(component, /no batch is synthesized/i)
  assert.doesNotMatch(component, /POST|PATCH|DELETE/)
})
