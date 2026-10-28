const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const read = (file) => fs.readFileSync(file, 'utf8')

test('admin orders are restricted to the active academic session window', () => {
  const route = read('app/api/admin/orders/route.ts')
  assert.match(route, /AcademicSession\.findOne\(\{ isActive: true \}\)/)
  assert.match(route, /createdAt:\s*\{\s*\$gte: currentSession\.startDate,\s*\$lte: currentSession\.endDate/)
  assert.match(route, /Promise\.all\(\[/)
  assert.match(route, /\.select\(ADMIN_ORDER_FIELDS\)/)
  assert.ok(route.indexOf('No active academic session is configured.') < route.indexOf('Order.find(filters)'))
})

test('accepted in-progress orders are returned only to their owning tasker', () => {
  const route = read('app/api/errands/route.ts')
  assert.match(route, /filter\.status = \{ \$in: \['in_progress', 'paid'\] \}/)
  assert.match(route, /String\(authenticatedTasker\._id\) !== taskerId/)
  assert.match(route, /if \(accepted === 'true'\) \{\s*return NextResponse\.json\(orders/)

  const cards = read('components/tasker/TaskCards.tsx')
  assert.match(cards, /In progress/)
})
