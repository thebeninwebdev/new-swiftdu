import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredServiceFeeResolution } from '@/lib/pricing-config'
import { connectDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  await connectDB()
  const taskType = request.nextUrl.searchParams.get('taskType') || ''
  const location = request.nextUrl.searchParams.get('location')
  const quote = await getConfiguredServiceFeeResolution({ taskType, location })
  return quote === null
    ? NextResponse.json({ error: 'No configured service fee for this task.' }, { status: 400 })
    : NextResponse.json(quote)
}
