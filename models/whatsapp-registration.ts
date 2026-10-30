import mongoose, { Schema, Document } from 'mongoose';

export type WhatsAppRegistrationStatus = 'pending' | 'linked';

export interface IWhatsAppRegistration extends Document {
  phone: string;
  name?: string;
  userId?: string;
  token: string;
  status: WhatsAppRegistrationStatus;
  linkedAt?: Date;
  whatsappConsentAt?: Date;
  whatsappConsentVersion?: string;
  whatsappConsentSource?: string;
  whatsappNotificationsEnabled?: boolean;
  whatsappConsentRevokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappRegistrationSchema = new Schema<IWhatsAppRegistration>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    userId: {
      type: String,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'linked'],
      default: 'pending',
      required: true,
    },
    linkedAt: Date,
    whatsappConsentAt: Date,
    whatsappConsentVersion: String,
    whatsappConsentSource: String,
    whatsappNotificationsEnabled: { type: Boolean, default: true },
    whatsappConsentRevokedAt: Date,
  },
  { timestamps: true }
);

export const WhatsAppRegistration =
  mongoose.models.WhatsAppRegistration ||
  mongoose.model<IWhatsAppRegistration>(
    'WhatsAppRegistration',
    whatsappRegistrationSchema
  );
