import { type NextRequest } from 'next/server'

import { compactSammyOrder, findCurrentCustomerOrder } from '@/lib/sammy/orders'
import { readSammyBody, resolveSammyCustomer, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string }>(request)
    const { user } = await resolveSammyCustomer(body.phone)
    const order = await findCurrentCustomerOrder(user)
    return { order: order ? compactSammyOrder(order) : null }
  })
}
