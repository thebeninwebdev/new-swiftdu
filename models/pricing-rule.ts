import mongoose, { Schema, type Model } from 'mongoose'

export type PricingTaskType = 'restaurant' | 'shopping' | 'printing' | 'indomie'
export interface IPricingRule { taskType: PricingTaskType; parentLocationId: mongoose.Types.ObjectId | null; serviceFee: number; enabled: boolean; label?: string; updatedBy?: string; locationId?: string }
const schema = new Schema<IPricingRule>({
  taskType: { type: String, enum: ['restaurant', 'shopping', 'printing', 'indomie'], required: true },
  parentLocationId: { type: Schema.Types.ObjectId, ref: 'CampusLocation', default: null, index: true },
  serviceFee: { type: Number, required: true, min: 1 },
  enabled: { type: Boolean, default: true }, label: String, updatedBy: String, locationId: String,
}, { timestamps: true })
// Legacy documents have no parentLocationId. Excluding those from this index
// keeps them readable while enforcing one default/override in the new shape.
schema.index({ taskType: 1, parentLocationId: 1 }, { unique: true, partialFilterExpression: { parentLocationId: { $exists: true } } })
schema.index({ taskType: 1, locationId: 1 }, { unique: true, sparse: true })
export const PricingRule = (mongoose.models.PricingRule as Model<IPricingRule> | undefined) || mongoose.model<IPricingRule>('PricingRule', schema)
