import mongoose, { Schema, type Model } from 'mongoose'

export interface IFirstOrderBonusClaim {
  userId: string
  sessionId: mongoose.Types.ObjectId
  orderId: string
  claimedAt: Date
  consumedAt?: Date
}

const schema = new Schema<IFirstOrderBonusClaim>({
  userId: { type: String, required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  orderId: { type: String, required: true },
  claimedAt: { type: Date, default: Date.now },
  consumedAt: Date,
}, { timestamps: true })

// The database, rather than a client-side eligibility check, is the authority.
schema.index({ userId: 1, sessionId: 1 }, { unique: true })
schema.index({ orderId: 1 })

export const FirstOrderBonusClaim = (mongoose.models.FirstOrderBonusClaim as Model<IFirstOrderBonusClaim> | undefined) || mongoose.model<IFirstOrderBonusClaim>('FirstOrderBonusClaim', schema)
