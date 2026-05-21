import mongoose, { Schema, Document } from 'mongoose';

export interface IWhatsAppProcessedMessage extends Document {
  messageId: string;
  phone: string;
  createdAt: Date;
}

const whatsappProcessedMessageSchema = new Schema<IWhatsAppProcessedMessage>({
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  phone: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const WhatsAppProcessedMessage =
  mongoose.models.WhatsAppProcessedMessage ||
  mongoose.model<IWhatsAppProcessedMessage>(
    'WhatsAppProcessedMessage',
    whatsappProcessedMessageSchema
  );
