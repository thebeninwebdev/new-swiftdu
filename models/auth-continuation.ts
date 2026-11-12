import { Schema, model, models } from "mongoose";

interface IAuthContinuation {
  referenceHash: string;
  destination: string;
  expiresAt: Date;
}

const AuthContinuationSchema = new Schema<IAuthContinuation>({
  referenceHash: { type: String, required: true, unique: true },
  destination: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const AuthContinuation =
  models.AuthContinuation ||
  model<IAuthContinuation>("AuthContinuation", AuthContinuationSchema);
