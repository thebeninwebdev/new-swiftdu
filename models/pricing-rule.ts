import mongoose, { Schema, type Model } from 'mongoose'

export type PricingTaskType = 'restaurant' | 'shopping' | 'printing' | 'indomie'
export interface IPricingRule { taskType: PricingTaskType; locationId: string; serviceFee: number; enabled: boolean; label?: string; updatedBy?: string }
const schema = new Schema<IPricingRule>({
  taskType: { type: String, enum: ['restaurant', 'shopping', 'printing', 'indomie'], required: true },
  locationId: { type: String, required: true, default: 'default' },
  serviceFee: { type: Number, required: true, min: 1 },
  enabled: { type: Boolean, default: true }, label: String, updatedBy: String,
}, { timestamps: true })
schema.index({ taskType: 1, locationId: 1 }, { unique: true })
export const PricingRule = (mongoose.models.PricingRule as Model<IPricingRule> | undefined) || mongoose.model<IPricingRule>('PricingRule', schema)
