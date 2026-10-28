const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const read = (file) => fs.readFileSync(file, 'utf8')

test('task tracking uses shared realtime with slow safety polling', () => {
  const taskerDetail = read('app/tasker-dashboard/[id]/page.tsx')
  const taskerDashboard = read('app/tasker-dashboard/page.tsx')
  const customerTracking = read('app/dashboard/tasks/TasksClient.tsx')

  for (const source of [taskerDetail, taskerDashboard, customerTracking]) {
    assert.match(source, /60_000/)
    assert.match(source, /30_000/)
    assert.doesNotMatch(source, /REFRESH[^\n=]*=\s*5_000/)
    assert.match(source, /fetchingRef/)
  }
  assert.match(customerTracking, /acquireSharedSocket\(\)/)
  assert.doesNotMatch(customerTracking, /\bio\s*\(/)
})

test('API compatibility helper no longer disconnects the shared socket', () => {
  const socket = read('lib/client-socket.ts')
  const helper = socket.slice(socket.indexOf('export async function fetchWithSocketPause'))
  assert.match(helper, /fetchWithTimeout\(input, init\)/)
  assert.doesNotMatch(helper, /\.disconnect\s*\(/)
})
