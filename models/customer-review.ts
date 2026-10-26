import mongoose, { Schema, type Document, type Model } from 'mongoose'

export interface ICustomerReview extends Document {
  taskerId: mongoose.Types.ObjectId
  customerId: string
  orderId: mongoose.Types.ObjectId
  rating: number
  comment: string
  isTestOrder: boolean
  createdAt: Date
  updatedAt: Date
}

const customerReviewSchema = new Schema<ICustomerReview>({
  taskerId: { type: Schema.Types.ObjectId, ref: 'Tasker', required: true, index: true },
  customerId: { type: String, required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', trim: true, maxlength: 500 },
  isTestOrder: { type: Boolean, default: false, index: true },
}, { timestamps: true })

export const CustomerReview: Model<ICustomerReview> = mongoose.models.CustomerReview || mongoose.model<ICustomerReview>('CustomerReview', customerReviewSchema)
