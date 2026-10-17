import mongoose, { Schema, type Document, type Model } from 'mongoose'

export interface IIndomieBatch extends Document {
  windowStart: Date; windowEnd: Date; groupKey: string; destinationKey: string; destinationLabel?: string; pickupKey: string
  taskerGenderRestriction: 'male' | 'female' | 'any'; orderIds: string[]; orderCount: number
  status: 'collecting' | 'available' | 'in_progress' | 'completed' | 'cancelled'
  isTestBatch: boolean; createdInMode: 'test' | 'live'; taskerId?: string; taskerName?: string; acceptedBy?: string; acceptedAt?: Date
  availableAt?: Date; pickedUpOrderIds: string[]; pickupCompletedAt?: Date; notificationSentAt?: Date
}
const schema = new Schema<IIndomieBatch>({
  windowStart: { type: Date, required: true }, windowEnd: { type: Date, required: true }, groupKey: { type: String, required: true },
  destinationKey: { type: String, required: true }, destinationLabel: String, pickupKey: { type: String, required: true },
  taskerGenderRestriction: { type: String, enum: ['male', 'female', 'any'], required: true }, orderIds: [{ type: String, required: true }], orderCount: { type: Number, required: true },
  status: { type: String, enum: ['collecting', 'available', 'in_progress', 'completed', 'cancelled'], default: 'collecting', index: true },
  isTestBatch: { type: Boolean, required: true, index: true }, createdInMode: { type: String, enum: ['test', 'live'], required: true }, taskerId: { type: String, index: true }, taskerName: String, acceptedBy: String, acceptedAt: Date,
  availableAt: Date, pickedUpOrderIds: { type: [String], default: [] }, pickupCompletedAt: Date, notificationSentAt: Date,
}, { timestamps: true })
schema.index({ groupKey: 1, status: 1 })
schema.index({ windowEnd: 1, status: 1 })
export const IndomieBatch = (mongoose.models.IndomieBatch as Model<IIndomieBatch> | undefined) || mongoose.model<IIndomieBatch>('IndomieBatch', schema)
