import { SAMMY_TASK_TYPES, type SammyOrderRequest } from './contracts'
import { SammyApiError } from './server'

const SERVER_OWNED_FIELDS = ['userId', 'serviceFee', 'platformFee', 'taskerFee', 'totalAmount'] as const

export function assertSammyOrderRequest(body: SammyOrderRequest & Record<string, unknown>) {
  if (SERVER_OWNED_FIELDS.some(field => field in body)) throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'The customer, fees and totals are resolved by SwiftDU.')
  if (!body.idempotencyKey?.trim() || body.idempotencyKey.length > 200) throw new SammyApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required.')
  if (!body.order || typeof body.order !== 'object') throw new SammyApiError(400, 'INVALID_DRAFT', 'An order draft is required.')
  if (!SAMMY_TASK_TYPES.includes(body.order.taskType)) throw new SammyApiError(400, 'INVALID_TASK_TYPE', 'Choose a supported service.')
  if (SERVER_OWNED_FIELDS.some(field => field in body.order)) throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'The customer, fees and totals are resolved by SwiftDU.')
  return body
}
