import { type NextRequest } from 'next/server'

import type { SammyOrderDraft } from '@/lib/sammy/contracts'
import { quoteSammyDraft } from '@/lib/sammy/quote'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { getStaffCustomerRecord, resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{
      telegram?: TelegramIdentity
      customerId?: string
      order?: SammyOrderDraft
      serviceFee?: unknown
      totalAmount?: unknown
    }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })
    if ('serviceFee' in body || 'totalAmount' in body) {
      throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'Fees and totals are resolved by SwiftDU.')
    }
    if (!body.customerId || !body.order) {
      throw new SammyApiError(400, 'INVALID_DRAFT', 'Customer and order draft are required.')
    }
    const forbidden = body.order as SammyOrderDraft & {
      serviceFee?: unknown; platformFee?: unknown; taskerFee?: unknown; totalAmount?: unknown; userId?: unknown
    }
    if ('serviceFee' in forbidden || 'platformFee' in forbidden || 'taskerFee' in forbidden || 'totalAmount' in forbidden || 'userId' in forbidden) {
      throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'Identity, fees and totals are resolved by SwiftDU.')
    }
    const customer = await getStaffCustomerRecord(body.customerId)
    return quoteSammyDraft(customer, body.order, { allowIncompleteProfile: true })
  })
}
