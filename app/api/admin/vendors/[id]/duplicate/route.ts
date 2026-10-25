import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Vendor } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'
import { isVendorServiceType, normalizeVendorName } from '@/lib/vendors'

async function admin(request: NextRequest) { const session = await auth.api.getSession({ headers: request.headers }); return session?.user?.role === 'admin' ? session : null }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await admin(request); const { id } = await params
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid vendor.' }, { status: 400 })
  const body = await request.json(), name = String(body.name || '').trim(), requestedServiceType = body.serviceType === undefined ? null : String(body.serviceType)
  if (!name || (requestedServiceType !== null && !isVendorServiceType(requestedServiceType))) return NextResponse.json({ error: 'Enter a duplicate name and valid service type.' }, { status: 400 })
  await connectDB()
  const source = await Vendor.findById(id).lean()
  if (!source) return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 })
  try {
    const duplicate = await Vendor.create({ name, normalizedName: normalizeVendorName(name), serviceType: requestedServiceType || source.serviceType, pickupParentLocationId: source.pickupParentLocationId, pickupExactLocationId: source.pickupExactLocationId, businessId: source.businessId || null, active: false, createdBy: session.user.id, updatedBy: session.user.id })
    const rules = await VendorDeliveryRule.find({ vendorId: source._id }).lean()
    if (rules.length) await VendorDeliveryRule.insertMany(rules.map(rule => ({ vendorId: duplicate._id, dropoffParentLocationId: rule.dropoffParentLocationId, serviceFee: rule.serviceFee, enabled: rule.enabled, updatedBy: session.user.id })))
    return NextResponse.json({ vendor: duplicate }, { status: 201 })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: 'A vendor with this name already exists.' }, { status: 409 })
    return NextResponse.json({ error: 'Unable to duplicate vendor.' }, { status: 400 })
  }
}
