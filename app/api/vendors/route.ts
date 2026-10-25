import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { Vendor } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'
import CampusLocation from '@/models/campus-location'
import { isVendorServiceType } from '@/lib/vendors'
export async function GET(request: NextRequest) { await connectDB(); const serviceType = request.nextUrl.searchParams.get('serviceType') || ''; if (!isVendorServiceType(serviceType)) return NextResponse.json({ error: 'Valid serviceType is required.' }, { status: 400 }); const vendors = await Vendor.find({ serviceType, active: true, pickupParentLocationId: { $ne: null } }).sort({ name: 1 }).lean(); const ids = vendors.map(v => v._id), pickupIds = vendors.map(v => v.pickupParentLocationId).filter((id): id is Types.ObjectId => id instanceof Types.ObjectId), [coverage, parents] = await Promise.all([VendorDeliveryRule.aggregate([{ $match: { vendorId: { $in: ids }, enabled: true } }, { $group: { _id: '$vendorId', count: { $sum: 1 } } }]), CampusLocation.find({ _id: { $in: pickupIds }, parentLocationId: null, active: true }).select('_id').lean()]); const activePickupIds = new Set(parents.map(p => String(p._id))), coverageIds = new Set(coverage.map(c => String(c._id))); return NextResponse.json({ vendors: vendors.filter(v => activePickupIds.has(String(v.pickupParentLocationId)) && coverageIds.has(String(v._id))).map(v => ({ id: String(v._id), name: v.name, serviceType: v.serviceType })) }) }
