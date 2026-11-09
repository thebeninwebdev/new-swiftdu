'use client'

type JsonObject = Record<string, unknown>
let profileCache: JsonObject | null = null
let profileRequest: Promise<JsonObject | null> | null = null
let excoCache: JsonObject | null = null
let excoRequest: Promise<JsonObject | null> | null = null

let operationsCache: JsonObject | null = null
let operationsRequest: Promise<JsonObject | null> | null = null
let operationsCacheTime = 0
const OPERATIONS_CACHE_TTL_MS = 60_000

let activeOrderCache: JsonObject | null = null
let activeOrderCacheSet = false
let activeOrderRequest: Promise<JsonObject | null> | null = null
let activeOrderCacheTime = 0
const ACTIVE_ORDER_CACHE_TTL_MS = 15_000

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

export function fetchDashboardOperations(force = false) {
  const now = Date.now()
  if (!force && operationsCache && now - operationsCacheTime < OPERATIONS_CACHE_TTL_MS) {
    return Promise.resolve(operationsCache)
  }
  if (operationsRequest) return operationsRequest
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = setTimeout(() => controller?.abort(), 10_000)
  const request = fetch('/api/operations/status', {
    cache: 'no-store',
    signal: controller?.signal,
  })
    .then(async (response) => (response.ok ? await response.json() as JsonObject : null))
    .catch(() => null)
    .then((value) => {
      if (value) {
        operationsCache = value
        operationsCacheTime = Date.now()
      }
      return value
    })
    .finally(() => {
      clearTimeout(timeout)
      operationsRequest = null
    })
  operationsRequest = request
  return request
}

export function fetchActiveOrderSummary(force = false) {
  const now = Date.now()
  if (!force && activeOrderCacheSet && now - activeOrderCacheTime < ACTIVE_ORDER_CACHE_TTL_MS) {
    return Promise.resolve(activeOrderCache)
  }
  if (activeOrderRequest) return activeOrderRequest
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = setTimeout(() => controller?.abort(), 10_000)
  const request = fetch('/api/orders?current=true&summary=true', {
    cache: 'no-store',
    signal: controller?.signal,
  })
    .then(async (response) => {
      if (response.ok) {
        const text = await response.text()
        return text ? (JSON.parse(text) as JsonObject) : null
      }
      return null
    })
    .catch(() => null)
    .then((value) => {
      activeOrderCache = value
      activeOrderCacheSet = true
      activeOrderCacheTime = Date.now()
      return value
    })
    .finally(() => {
      clearTimeout(timeout)
      activeOrderRequest = null
    })
  activeOrderRequest = request
  return request
}

export function updateActiveOrderCache(order: JsonObject | null) {
  activeOrderCache = order
  activeOrderCacheSet = true
  activeOrderCacheTime = Date.now()
}
