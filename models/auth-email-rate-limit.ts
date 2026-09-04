import { Schema, model, models } from "mongoose";

interface IAuthEmailRateLimit {
  email: string;
  windowStartedAt: Date;
  lastSentAt: Date;
  sendCount: number;
  expiresAt: Date;
}

const AuthEmailRateLimitSchema = new Schema<IAuthEmailRateLimit>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  windowStartedAt: { type: Date, required: true },
  lastSentAt: { type: Date, required: true },
  sendCount: { type: Number, required: true, default: 1 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const AuthEmailRateLimit =
  models.AuthEmailRateLimit ||
  model<IAuthEmailRateLimit>("AuthEmailRateLimit", AuthEmailRateLimitSchema);
