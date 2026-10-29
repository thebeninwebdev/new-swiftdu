import mongoose, { Schema, type Document } from 'mongoose'

export type WhatsAppMessageProcessingStatus = 'processing' | 'completed' | 'failed'

export interface IWhatsAppProcessedMessage extends Document {
  messageId: string
  phone: string
  status: WhatsAppMessageProcessingStatus
  attempts: number
  leaseExpiresAt?: Date
  processedAt?: Date
  lastErrorCode?: string
  createdAt: Date
  updatedAt: Date
}

const schema = new Schema<IWhatsAppProcessedMessage>({
  messageId: { type: String, required: true, unique: true, index: true },
  phone: { type: String, required: true, index: true },
  status: { type: String, enum: ['processing', 'completed', 'failed'], required: true, index: true },
  attempts: { type: Number, default: 0 },
  leaseExpiresAt: Date,
  processedAt: Date,
  lastErrorCode: String,
}, { timestamps: true })

schema.index({ status: 1, leaseExpiresAt: 1 })

export const WhatsAppProcessedMessage = mongoose.models.WhatsAppProcessedMessage ||
  mongoose.model<IWhatsAppProcessedMessage>('WhatsAppProcessedMessage', schema)
