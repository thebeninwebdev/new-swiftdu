import mongoose, { Schema, type Model } from 'mongoose'
export interface IVendorDeliveryRule { vendorId: mongoose.Types.ObjectId; dropoffParentLocationId: mongoose.Types.ObjectId; serviceFee: number; enabled: boolean; updatedBy?: string }
const schema = new Schema<IVendorDeliveryRule>({
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true }, dropoffParentLocationId: { type: Schema.Types.ObjectId, ref: 'CampusLocation', required: true, index: true },
  serviceFee: { type: Number, required: true, min: 1 }, enabled: { type: Boolean, default: true, index: true }, updatedBy: String,
}, { timestamps: true })
schema.index({ vendorId: 1, dropoffParentLocationId: 1 }, { unique: true })
export const VendorDeliveryRule = (mongoose.models.VendorDeliveryRule as Model<IVendorDeliveryRule> | undefined) || mongoose.model<IVendorDeliveryRule>('VendorDeliveryRule', schema)
