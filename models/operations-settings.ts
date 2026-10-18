import mongoose, { Schema, type Model } from 'mongoose'

export interface IOperationsSettings {
  key: 'default'
  openMinute: number
  closeMinute: number
  updatedBy?: string
}

const schema = new Schema<IOperationsSettings>({
  key: { type: String, enum: ['default'], unique: true, default: 'default' },
  openMinute: { type: Number, required: true, default: 7 * 60 },
  closeMinute: { type: Number, required: true, default: 22 * 60 },
  updatedBy: String,
}, { timestamps: true })

export const OperationsSettings = (mongoose.models.OperationsSettings as Model<IOperationsSettings> | undefined) || mongoose.model<IOperationsSettings>('OperationsSettings', schema)
