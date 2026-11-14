import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_SITE_URL, getSiteUrl, getTrustedOrigins } from './site'

test('production uses one canonical Better Auth URL and trusts apex plus www', (t) => {
  const env = process.env as Record<string, string | undefined>
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SWIFTDU_BASE_URL: process.env.SWIFTDU_BASE_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    BASE_URL: process.env.BASE_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  }
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  env.NODE_ENV = 'production'
  delete process.env.VERCEL_ENV
  process.env.SWIFTDU_BASE_URL = 'https://swiftdu.org'
  delete process.env.NEXT_PUBLIC_BASE_URL
  delete process.env.BASE_URL
  delete process.env.BETTER_AUTH_URL

  assert.equal(getSiteUrl(), DEFAULT_SITE_URL)
  assert.deepEqual(new Set(getTrustedOrigins()), new Set(['https://swiftdu.org', 'https://www.swiftdu.org']))
})
