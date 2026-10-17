import mongoose, { Schema, type Model } from 'mongoose'

export interface IIndomieBatchSettings { key: 'default'; startMinute: number; endMinute: number; windowMinutes: number; updatedBy?: string }
const schema = new Schema<IIndomieBatchSettings>({ key: { type: String, enum: ['default'], unique: true, default: 'default' }, startMinute: { type: Number, required: true, default: 18 * 60 }, endMinute: { type: Number, required: true, default: 21 * 60 }, windowMinutes: { type: Number, required: true, default: 15 }, updatedBy: String }, { timestamps: true })
export const IndomieBatchSettings = (mongoose.models.IndomieBatchSettings as Model<IIndomieBatchSettings> | undefined) || mongoose.model<IIndomieBatchSettings>('IndomieBatchSettings', schema)
