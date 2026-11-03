import { Document, model, models, Schema, Types } from 'mongoose'

export interface ITelegramLinkChallenge extends Document {
  tokenHash: string
  telegramUserId: string
  telegramChatId: string
  telegramUsername?: string
  telegramFirstName?: string
  telegramLastName?: string
  botUsername?: string
  expiresAt: Date
  consumedAt?: Date
  consumedByUserId?: Types.ObjectId
  invalidatedAt?: Date
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const TelegramLinkChallengeSchema = new Schema<ITelegramLinkChallenge>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  telegramUserId: { type: String, required: true },
  telegramChatId: { type: String, required: true },
  telegramUsername: { type: String, trim: true },
  telegramFirstName: { type: String, trim: true },
  telegramLastName: { type: String, trim: true },
  botUsername: { type: String, trim: true },
  expiresAt: { type: Date, required: true },
  consumedAt: Date,
  consumedByUserId: { type: Schema.Types.ObjectId, ref: 'user' },
  invalidatedAt: Date,
  active: { type: Boolean, required: true, default: true },
}, { timestamps: true, collection: 'telegram_link_challenges' })

// TTL cleanup is best effort. Application reads always check expiresAt too.
TelegramLinkChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
TelegramLinkChallengeSchema.index({ telegramUserId: 1, createdAt: -1 })
TelegramLinkChallengeSchema.index(
  { telegramUserId: 1 },
  { unique: true, partialFilterExpression: { active: true } }
)

export const TelegramLinkChallenge = models.TelegramLinkChallenge ||
  model<ITelegramLinkChallenge>('TelegramLinkChallenge', TelegramLinkChallengeSchema)
