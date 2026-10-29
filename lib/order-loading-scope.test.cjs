const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const read = (file) => fs.readFileSync(file, 'utf8')

test('admin orders use the shared migration-safe active-session scope', () => {
  const route = read('app/api/admin/orders/route.ts')
  assert.match(route, /getActiveAcademicSession\(\)/)
  assert.match(route, /applyCurrentSessionOrderScope\(filters, currentSession\)/)
  assert.match(route, /Promise\.all\(\[/)
  assert.match(route, /\.select\(ADMIN_ORDER_FIELDS\)/)
  const helper = read('lib/orders/order-session-filter.ts')
  assert.match(helper, /sessionId: session\.id/)
  assert.match(helper, /sessionId: \{ \$exists: false \}/)
  assert.match(read('lib/orders/order-session-scope.ts'), /NoActiveOrderSessionError/)
})

test('customer task history requests only the selected tab with bounded paging', () => {
  const client = read('app/dashboard/tasks/TaskListClient.tsx')
  assert.match(client, /paginated: 'true'/)
  assert.match(client, /if \(tab === 'in_progress'\) return 'pending,in_progress,paid'/)
  assert.doesNotMatch(client, /status=pending,in_progress,paid,completed,cancelled/)
  assert.match(client, /Load more/)
})

test('accepted in-progress orders are returned only to their owning tasker', () => {
  const route = read('app/api/errands/route.ts')
  assert.match(route, /filter\.status = \{ \$in: \['in_progress', 'paid'\] \}/)
  assert.match(route, /String\(authenticatedTasker\._id\) !== taskerId/)
  assert.match(route, /if \(accepted === 'true'\) \{\s*return NextResponse\.json\(orders/)

  const cards = read('components/tasker/TaskCards.tsx')
  assert.match(cards, /In progress/)
})
