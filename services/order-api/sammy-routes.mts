import type { NextRequest } from 'next/server'
import type { BackgroundScheduler } from '@/lib/order-creation-background'

// Keep one authoritative implementation of each Sammy route in the SwiftDU app.
// The Render worker invokes these handlers IN PROCESS: no HTTP requests to Vercel.
const ROOT = '/api/internal/sammy'
const STAFF = ROOT + '/staff'

type RouteKey =
  | 'staff-auth'
  | 'staff-customers-search'
  | 'staff-customers-create'
  | 'staff-customer-read'
  | 'staff-customer-update'
  | 'staff-customer-phones'
  | 'staff-customer-phones-check'
  | 'staff-locations'
  | 'staff-catalog'
  | 'staff-quote'
  | 'staff-orders-create'
  | 'staff-orders-search'
  | 'staff-orders-cancel'
  | 'telegram-link-start'
  | 'telegram-link-status'

export type SammyRouteMatch = { key: RouteKey; id?: string }

const STATIC_ROUTES = new Map<string, RouteKey>([
  [`POST ${STAFF}/auth`, 'staff-auth'],
  [`POST ${STAFF}/customers/search`, 'staff-customers-search'],
  [`POST ${STAFF}/customers/create`, 'staff-customers-create'],
  [`POST ${STAFF}/locations`, 'staff-locations'],
  [`POST ${STAFF}/catalog`, 'staff-catalog'],
  [`POST ${STAFF}/quote`, 'staff-quote'],
  [`POST ${STAFF}/orders`, 'staff-orders-create'],
  [`POST ${STAFF}/orders/search`, 'staff-orders-search'],
  [`POST ${ROOT}/telegram/link/start`, 'telegram-link-start'],
  [`POST ${ROOT}/telegram/link/status`, 'telegram-link-status'],
])

/**
 * This is a deliberate allowlist of Telegram staff routes, not a general
 * Next.js server or an open proxy to the public SwiftDU application.
 */
export function resolveSammyRoute(method: string, pathname: string): SammyRouteMatch | null {
  const key = STATIC_ROUTES.get(`${method} ${pathname}`)
  if (key) return { key }

  const customer = /^\/api\/internal\/sammy\/staff\/customers\/([^/]+)$/.exec(pathname)
  if (customer && (method === 'POST' || method === 'PATCH')) {
    return {
      key: method === 'POST' ? 'staff-customer-read' : 'staff-customer-update',
      id: safelyDecode(customer[1]),
    }
  }

  const phones = /^\/api\/internal\/sammy\/staff\/customers\/([^/]+)\/phones$/.exec(pathname)
  if (phones && method === 'POST') return { key: 'staff-customer-phones', id: safelyDecode(phones[1]) }

  const check = /^\/api\/internal\/sammy\/staff\/customers\/([^/]+)\/phones\/check$/.exec(pathname)
  if (check && method === 'POST') return { key: 'staff-customer-phones-check', id: safelyDecode(check[1]) }

  const cancel = /^\/api\/internal\/sammy\/staff\/orders\/([^/]+)\/cancel$/.exec(pathname)
  if (cancel && method === 'POST') return { key: 'staff-orders-cancel', id: safelyDecode(cancel[1]) }

  return null
}

function safelyDecode(segment: string) {
  // Keep invalid percent encodings or encoded separators away from route handlers.
  if (/%2f|%5c/i.test(segment)) return ''
  try {
    const value = decodeURIComponent(segment)
    return value && !value.includes('/') && !value.includes('\\') ? value : ''
  } catch {
    return ''
  }
}

const notFound = () => new Response(JSON.stringify({ error: 'Not found.' }), {
  status: 404,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
})

/**
 * Invoke the existing Next route handlers with synthetic NextRequest and params
 * while running on Render. Their bearer-secret, role, suspension, validation,
 * idempotency and MongoDB checks remain authoritative.
 */
export async function dispatchSammyRoute(
  request: NextRequest,
  scheduleBackground?: BackgroundScheduler,
): Promise<Response> {
  const route = resolveSammyRoute(request.method, request.nextUrl.pathname)
  if (!route || (route.id !== undefined && route.id === '')) return notFound()

  const context = { params: Promise.resolve({ id: route.id || '' }) }
  switch (route.key) {
    case 'staff-auth':
      return (await import('@/app/api/internal/sammy/staff/auth/route')).POST(request)
    case 'staff-customers-search':
      return (await import('@/app/api/internal/sammy/staff/customers/search/route')).POST(request)
    case 'staff-customers-create':
      return (await import('@/app/api/internal/sammy/staff/customers/create/route')).POST(request)
    case 'staff-customer-read':
      return (await import('@/app/api/internal/sammy/staff/customers/[id]/route')).POST(request, context)
    case 'staff-customer-update':
      return (await import('@/app/api/internal/sammy/staff/customers/[id]/route')).PATCH(request, context)
    case 'staff-customer-phones':
      return (await import('@/app/api/internal/sammy/staff/customers/[id]/phones/route')).POST(request, context)
    case 'staff-customer-phones-check':
      return (await import('@/app/api/internal/sammy/staff/customers/[id]/phones/check/route')).POST(request, context)
    case 'staff-locations':
      return (await import('@/app/api/internal/sammy/staff/locations/route')).POST(request)
    case 'staff-catalog':
      return (await import('@/app/api/internal/sammy/staff/catalog/route')).POST(request)
    case 'staff-quote':
      return (await import('@/app/api/internal/sammy/staff/quote/route')).POST(request)
    case 'staff-orders-create':
      return (await import('@/lib/sammy/staff-order-service')).handleSammyStaffOrder(request, scheduleBackground)
    case 'staff-orders-search':
      return (await import('@/app/api/internal/sammy/staff/orders/search/route')).POST(request)
    case 'staff-orders-cancel':
      return (await import('@/app/api/internal/sammy/staff/orders/[id]/cancel/route')).POST(request, context)
    case 'telegram-link-start':
      return (await import('@/app/api/internal/sammy/telegram/link/start/route')).POST(request)
    case 'telegram-link-status':
      return (await import('@/app/api/internal/sammy/telegram/link/status/route')).POST(request)
  }
}
