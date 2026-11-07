import { NextRequest } from 'next/server'
import { handleSammyStaffOrder } from '@/lib/sammy/staff-order-service'

export async function POST(request: NextRequest) {
  return handleSammyStaffOrder(request)
}
