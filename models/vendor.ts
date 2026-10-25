import mongoose, { Schema, type Model } from 'mongoose'

export const VENDOR_SERVICE_TYPES = ['shopping', 'restaurant', 'printing', 'indomie'] as const
export type VendorServiceType = typeof VENDOR_SERVICE_TYPES[number]
export interface IVendor {
  name: string; normalizedName: string; serviceType: VendorServiceType
  pickupParentLocationId?: mongoose.Types.ObjectId | null; pickupExactLocationId?: mongoose.Types.ObjectId | null
  businessId?: mongoose.Types.ObjectId | null; active: boolean; createdBy?: string; updatedBy?: string
}
const vendorSchema = new Schema<IVendor>({
  name: { type: String, required: true, trim: true, maxlength: 120 }, normalizedName: { type: String, required: true, unique: true, index: true },
  serviceType: { type: String, enum: VENDOR_SERVICE_TYPES, required: true, index: true },
  pickupParentLocationId: { type: Schema.Types.ObjectId, ref: 'CampusLocation', default: null, index: true },
  pickupExactLocationId: { type: Schema.Types.ObjectId, ref: 'CampusLocation', default: null },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null }, active: { type: Boolean, default: false, index: true }, createdBy: String, updatedBy: String,
}, { timestamps: true })
vendorSchema.index({ serviceType: 1, active: 1, name: 1 })
export const Vendor = (mongoose.models.Vendor as Model<IVendor> | undefined) || mongoose.model<IVendor>('Vendor', vendorSchema)
