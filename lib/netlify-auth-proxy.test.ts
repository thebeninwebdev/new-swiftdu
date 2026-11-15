import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { handleProxy, loadNetlifyProxySession } from '../proxy'

test('Netlify proxy verifies role using the Node auth route with only same-origin cookies', async (t) => {
  process.env.OPERATIONS_ENABLED = 'true'
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  let called = false
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    called = true
    assert.equal(String(input), 'https://serene-paprenjak-6477d6.netlify.app/api/auth/get-session')
    assert.equal(init?.headers && new Headers(init.headers).get('cookie'), 'better-auth.session_token=fake-cookie')
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.redirect, 'manual')
    return Response.json({ user: { id: 'tasker-123', role: 'tasker' }, session: { id: 's1' } })
  }) as typeof fetch
  const request = new NextRequest('https://serene-paprenjak-6477d6.netlify.app/tasker-dashboard', {
    headers: { cookie: 'better-auth.session_token=fake-cookie' },
  })
  const response = await handleProxy(request, () => loadNetlifyProxySession(request))
  assert.equal(called, true)
  assert.equal(response.headers.get('location'), null)
})

test('Netlify proxy redirects a confirmed anonymous session to auth', async (t) => {
  process.env.OPERATIONS_ENABLED = 'true'
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  globalThis.fetch = (async () => Response.json(null)) as typeof fetch
  const request = new NextRequest('https://test.netlify.app/dashboard?view=orders')
  const response = await handleProxy(request, () => loadNetlifyProxySession(request))
  assert.equal(response.headers.get('location'), 'https://test.netlify.app/auth?next=%2Fdashboard%3Fview%3Dorders')
})

test('Netlify proxy fails closed on unavailable or malformed session responses', async (t) => {
  process.env.OPERATIONS_ENABLED = 'true'
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  for (const response of [new Response('unavailable', { status: 503 }), Response.json({ bad: true })]) {
    globalThis.fetch = (async () => response) as typeof fetch
    const request = new NextRequest('https://test.netlify.app/admin')
    const result = await handleProxy(request, () => loadNetlifyProxySession(request))
    assert.equal(result.status, 503)
    assert.equal(result.headers.get('location'), null)
  }
})
