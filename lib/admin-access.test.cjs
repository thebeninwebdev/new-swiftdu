const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

let currentAccess
const source = fs.readFileSync('lib/admin-access.ts', 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const moduleRecord = { exports: {} }
vm.runInNewContext(code, {
  exports: moduleRecord.exports,
  module: moduleRecord,
  require: (name) => {
    if (name === '@/lib/exco') {
      return { getExcoAccess: async () => currentAccess }
    }
    throw new Error(`Unexpected import: ${name}`)
  },
})

const { canAccessAdminDashboard, getAdminDashboardAccess } = moduleRecord.exports

test('admin dashboard access treats admins and every recognized EXCO equally', async () => {
  const admin = { isAuthenticated: true, userId: 'admin-id', userRole: 'admin', excoRole: null }
  const user = { isAuthenticated: true, userId: 'user-id', userRole: 'user', excoRole: null }

  assert.equal(canAccessAdminDashboard(admin), true)
  for (const excoRole of ['CFO', 'CMO', 'COO', 'CTO']) {
    assert.equal(
      canAccessAdminDashboard({ isAuthenticated: true, userId: `${excoRole}-id`, userRole: 'user', excoRole }),
      true,
    )
  }
  assert.equal(canAccessAdminDashboard(user), false)
  assert.equal(canAccessAdminDashboard({ isAuthenticated: false, excoRole: null }), false)

  currentAccess = { isAuthenticated: true, userId: 'exco-id', userRole: 'user', excoRole: 'CTO' }
  assert.equal((await getAdminDashboardAccess(new Headers())).userId, 'exco-id')
  currentAccess = user
  assert.equal(await getAdminDashboardAccess(new Headers()), null)
})

function routeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? routeFiles(target) : entry.name === 'route.ts' ? [target] : []
  })
}

test('every admin API route uses the shared admin-or-EXCO guard', () => {
  for (const file of routeFiles('app/api/admin')) {
    const route = fs.readFileSync(file, 'utf8')
    assert.match(route, /getAdminDashboardAccess|isBusinessAdmin/, `${file} must enforce admin dashboard access`)
  }
})
