import mongoose, { Schema, Document, models, model } from 'mongoose'

export type MessageCategory =
  | 'intro'
  | 'payment'
  | 'update'
  | 'unavailable'
  | 'clarification'
  | 'delivery'
  | 'general'

export type MessagePaymentType = 'none' | 'service_fee' | 'items' | 'total'

export interface IMessageTemplate extends Document {
  title: string
  description: string
  category: MessageCategory
  body: string
  orderTypes: string[]
  applicableStates: string[]
  requiresPaymentVerification: boolean
  paymentType: MessagePaymentType
  displayOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['intro', 'payment', 'update', 'unavailable', 'clarification', 'delivery', 'general'],
      default: 'general',
      index: true,
    },
    body: {
      type: String,
      required: true,
    },
    orderTypes: {
      type: [String],
      default: ['all'],
      index: true,
    },
    applicableStates: {
      type: [String],
      default: ['all'],
      index: true,
    },
    requiresPaymentVerification: {
      type: Boolean,
      default: false,
    },
    paymentType: {
      type: String,
      enum: ['none', 'service_fee', 'items', 'total'],
      default: 'none',
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'message_templates',
  }
)

MessageTemplateSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 })

export const MessageTemplate: mongoose.Model<IMessageTemplate> =
  models.MessageTemplate || model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema)

export default MessageTemplate
