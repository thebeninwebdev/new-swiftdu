'use client'

type JsonObject = Record<string, unknown>
let profileCache: JsonObject | null = null
let profileRequest: Promise<JsonObject | null> | null = null
let excoCache: JsonObject | null = null
let excoRequest: Promise<JsonObject | null> | null = null

function cachedRequest(url: string, force: boolean, kind: 'profile' | 'exco') {
  const cached = kind === 'profile' ? profileCache : excoCache
  const pending = kind === 'profile' ? profileRequest : excoRequest
  if (!force && cached) return Promise.resolve(cached)
  if (pending) return pending
  const request = fetch(url, { cache: 'no-store' })
    .then(async (response) => response.ok ? await response.json() as JsonObject : null)
    .catch(() => null)
    .then((value) => {
      if (kind === 'profile') profileCache = value
      else excoCache = value
      return value
    })
    .finally(() => {
      if (kind === 'profile') profileRequest = null
      else excoRequest = null
    })
  if (kind === 'profile') profileRequest = request
  else excoRequest = request
  return request
}

export function fetchDashboardProfile(force = false) {
  return cachedRequest('/api/users/me/profile', force, 'profile')
}

export function fetchDashboardExco(force = false) {
  return cachedRequest('/api/exco/me', force, 'exco')
}
