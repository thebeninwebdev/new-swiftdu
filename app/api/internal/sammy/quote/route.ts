import { type NextRequest } from 'next/server'

import type { SammyOrderDraft } from '@/lib/sammy/contracts'
import { quoteSammyDraft } from '@/lib/sammy/quote'
import { readSammyBody, resolveSammyCustomer, SammyApiError, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string; order?: SammyOrderDraft; serviceFee?: unknown; totalAmount?: unknown; userId?: unknown }>(request)
    if ('serviceFee' in body || 'totalAmount' in body || 'userId' in body) throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'Identity, fees and totals are resolved by SwiftDU.')
    if (!body.order || typeof body.order !== 'object') throw new SammyApiError(400, 'INVALID_DRAFT', 'An order draft is required.')
    const forbidden = body.order as SammyOrderDraft & { serviceFee?: unknown; platformFee?: unknown; taskerFee?: unknown; totalAmount?: unknown; userId?: unknown }
    if ('serviceFee' in forbidden || 'platformFee' in forbidden || 'taskerFee' in forbidden || 'totalAmount' in forbidden || 'userId' in forbidden) throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'Identity, fees and totals are resolved by SwiftDU.')
    const { user } = await resolveSammyCustomer(body.phone)
    return quoteSammyDraft(user, body.order)
  })
}
