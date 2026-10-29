import 'server-only'

import { NextRequest } from 'next/server'

export type CustomerOrderSource = 'website' | 'whatsapp'

export type CustomerOrderActor = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  source: CustomerOrderSource
  customerPhone?: string
  customerName?: string
}

export type CustomerOrderInput = Record<string, unknown>

export class CustomerOrderServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'CustomerOrderServiceError'
  }
}

type CustomerOrderImplementation = (
  request: NextRequest,
  actorOverride?: CustomerOrderActor
) => Promise<Response>

let implementation: CustomerOrderImplementation | undefined

export function registerCustomerOrderImplementation(value: CustomerOrderImplementation) {
  implementation = value
}

/**
 * In-process adapter to the single authoritative customer-order implementation.
 * It deliberately invokes the same validation/pricing/persistence function as the
 * website route; it does not issue an HTTP request to this deployment.
 */
export async function createCustomerOrder(
  actor: CustomerOrderActor,
  input: CustomerOrderInput,
  idempotencyKey?: string
) {
  if (!implementation) {
    // Loading the route module registers the one authoritative implementation.
    // This remains an in-process module load; no HTTP request is made.
    await import('@/app/api/orders/route')
  }
  if (!implementation) throw new Error('Customer order implementation is unavailable.')
  const headers = new Headers({ 'content-type': 'application/json' })
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey)
  const request = new NextRequest('http://swiftdu.internal/api/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const response = await implementation(request, actor)
  const payload = await response.json() as Record<string, unknown>
  if (!response.ok) {
    throw new CustomerOrderServiceError(
      typeof payload.error === 'string' ? payload.error : 'Failed to create order.',
      response.status,
      typeof payload.code === 'string' ? payload.code : undefined,
      payload
    )
  }
  return { order: payload, recovered: response.status === 200 }
}
