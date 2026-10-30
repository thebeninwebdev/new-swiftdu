import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

import { connectDB } from '@/lib/db'
import { normalizeWhatsAppPhone } from '@/lib/whatsapp/registration'
import { User } from '@/models/user'
import { WhatsAppRegistration, type IWhatsAppRegistration } from '@/models/whatsapp-registration'

export class SammyApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function authenticateSammyRequest(request: NextRequest) {
  const configured = process.env.SAMMY_SWIFTDU_INTERNAL_SECRET?.trim()
  if (!configured) throw new SammyApiError(503, 'INTERNAL_AUTH_NOT_CONFIGURED', 'Sammy integration is unavailable.')
  const authorization = request.headers.get('authorization') || ''
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!supplied || !equalSecret(supplied, configured)) {
    throw new SammyApiError(401, 'UNAUTHORIZED', 'Invalid internal service credentials.')
  }
}

export async function readSammyBody<T>(request: NextRequest): Promise<T> {
  try { return await request.json() as T } catch { throw new SammyApiError(400, 'INVALID_JSON', 'A valid JSON body is required.') }
}

export async function resolveSammyCustomer(phone: unknown) {
  const normalizedPhone = normalizeWhatsAppPhone(typeof phone === 'string' ? phone : '')
  if (!normalizedPhone) throw new SammyApiError(400, 'INVALID_PHONE', 'A WhatsApp phone number is required.')
  await connectDB()
  const registration = await WhatsAppRegistration.findOne({ phone: normalizedPhone, status: 'linked', userId: { $exists: true, $ne: '' } })
  if (!registration?.userId) throw new SammyApiError(404, 'WHATSAPP_NOT_LINKED', 'Link this WhatsApp number to a SwiftDU account first.')
  const user = await User.findById(registration.userId)
    .select('_id name email phone role taskerId gender location defaultLocation isSuspended isExco excoRole testOrderMode serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders')
    .lean()
  if (!user) throw new SammyApiError(404, 'ACCOUNT_NOT_FOUND', 'The linked SwiftDU account no longer exists.')
  if (user.isSuspended) throw new SammyApiError(403, 'ACCOUNT_SUSPENDED', 'This SwiftDU account is suspended.')
  return { phone: normalizedPhone, registration: registration as IWhatsAppRegistration, user }
}

export function sammyErrorResponse(error: unknown) {
  if (error instanceof SammyApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  console.error('[Internal Sammy API Error]', error)
  return NextResponse.json({ error: 'The request could not be completed.', code: 'INTERNAL_ERROR' }, { status: 500 })
}

export async function withSammy<T>(request: NextRequest, action: () => Promise<T | NextResponse>) {
  try {
    authenticateSammyRequest(request)
    const result = await action()
    return result instanceof NextResponse ? result : NextResponse.json(result)
  } catch (error) { return sammyErrorResponse(error) }
}
