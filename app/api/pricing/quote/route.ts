import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredServiceFee } from '@/lib/pricing-config'
export async function GET(request: NextRequest) { const taskType = request.nextUrl.searchParams.get('taskType') || '', location = request.nextUrl.searchParams.get('location'); const serviceFee = await getConfiguredServiceFee({ taskType, location }); return serviceFee === null ? NextResponse.json({ error: 'No configured service fee for this task.' }, { status: 400 }) : NextResponse.json({ serviceFee }) }
