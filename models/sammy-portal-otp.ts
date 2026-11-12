import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * One short-lived, email-delivered proof per Render-hosted connection token.
 * The challenge token is known only to the relevant Telegram/WhatsApp user.
 * Verification codes are stored ONLY as keyed digests.
 */
const schema = new Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  purpose: { type: String, required: true, enum: ['telegram', 'whatsapp'] },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0, required: true },
  sentCount: { type: Number, default: 0, required: true },
  lastSentAt: { type: Date, required: true },
  consumedAt: Date,
}, { timestamps: true, collection: 'sammy_portal_otps' })

// Keep expired records briefly to enforce cross-challenge email rate limits.
// Reads check expiresAt; this TTL is only a database cleanup mechanism.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })
schema.index({ userId: 1, createdAt: -1 })

export type SammyPortalOtpRecord = InferSchemaType<typeof schema>
export const SammyPortalOtp = mongoose.models.SammyPortalOtp ||
  mongoose.model('SammyPortalOtp', schema)
