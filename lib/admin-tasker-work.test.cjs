const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('lib/admin-tasker-work.ts', 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const moduleRecord = { exports: {} }
vm.runInNewContext(code, {
  exports: moduleRecord.exports,
  module: moduleRecord,
  require: (name) => {
    if (name === '@/lib/test-orders') return { getTaskerMode: (tasker) => tasker.taskerMode || (tasker.isVerified ? 'live' : 'training') }
    if (name === '@/lib/tasker-work') return {
      LONG_WORK_SESSION_MS: 8 * 60 * 60 * 1000,
      TASKER_BUSY_ORDER_STATUSES: ['in_progress', 'paid'],
      getWorkStatus: (checkedIn, activeTasks) => activeTasks > 0 ? 'busy' : checkedIn ? 'available' : 'offline',
    }
    if (['@/models/tasker', '@/models/user', '@/models/order', '@/models/tasker-work-session'].includes(name)) return {}
    throw new Error(`Unexpected import: ${name}`)
  },
})
const { buildAdminTaskerWorkOverview } = moduleRecord.exports
const now = new Date('2026-10-30T12:00:00.000Z')
const taskers = [
  { _id: 'available', userId: 'user-a', phone: '0801', isVerified: true, taskerMode: 'live' },
  { _id: 'busy', userId: 'user-b', phone: '0802', isVerified: true, taskerMode: 'training' },
  { _id: 'offline', userId: 'user-c', phone: '0803', isVerified: true, taskerMode: 'live' },
]
const users = [
  { _id: 'user-a', name: 'Available Tasker', email: 'available@example.com' },
  { _id: 'user-b', name: 'Busy Tasker', email: 'busy@example.com' },
  { _id: 'user-c', name: 'Offline Tasker', email: 'offline@example.com' },
]

test('admin tasker overview returns available, busy, offline, checkout and mode state', () => {
  const overview = buildAdminTaskerWorkOverview({
    taskers, users, now,
    openSessions: [
      { taskerId: 'available', startedAt: '2026-10-30T10:00:00.000Z' },
      { taskerId: 'busy', startedAt: '2026-10-30T11:00:00.000Z' },
    ],
    latestClosedSessions: [{ _id: 'offline', endedAt: '2026-10-29T17:12:00.000Z' }],
    activeOrders: [{ _id: 'order-1', taskerId: 'busy', taskType: 'restaurant', status: 'in_progress' }],
  })
  assert.deepEqual({ ...overview.summary }, { total: 3, checkedIn: 2, available: 1, busy: 1, offline: 1 })
  assert.equal(overview.taskers.find((item) => item.taskerId === 'available').status, 'available')
  const busy = overview.taskers.find((item) => item.taskerId === 'busy')
  assert.equal(busy.status, 'busy')
  assert.equal(busy.activeTask.type, 'restaurant')
  assert.equal(busy.mode, 'training')
  const offline = overview.taskers.find((item) => item.taskerId === 'offline')
  assert.equal(offline.status, 'offline')
  assert.equal(offline.lastCheckedOutAt, '2026-10-29T17:12:00.000Z')
  assert.equal(offline.mode, 'live')
})

test('sessions longer than eight hours are flagged without changing availability', () => {
  const overview = buildAdminTaskerWorkOverview({
    taskers: [taskers[0]], users: [users[0]], now,
    openSessions: [{ taskerId: 'available', startedAt: '2026-10-30T03:59:59.000Z' }],
    latestClosedSessions: [], activeOrders: [],
  })
  assert.equal(overview.taskers[0].longSession, true)
  assert.equal(overview.taskers[0].checkedIn, true)
  assert.equal(overview.taskers[0].status, 'available')
})

test('live endpoint is guarded and overview data is fetched in batches', () => {
  const route = fs.readFileSync('app/api/admin/taskers/live/route.ts', 'utf8')
  assert.match(route, /getAdminDashboardAccess\(request\.headers\)/)
  assert.match(route, /status: 403/)
  assert.match(route, /getAdminTaskerWorkOverview\(\)/)
  assert.match(source, /Promise\.all\(/)
  assert.match(source, /taskerId: \{ \$in: taskerIds \}/)
  assert.doesNotMatch(source, /for \(const tasker[^]*?(?:\.find\(|\.aggregate\()/)
})
