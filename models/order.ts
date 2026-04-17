import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  userId: string;
  taskType: string;
  description?: string;
  amount: number;
  commission: number;
  platformFee: number;
  taskerFee: number;
  serviceFee: number;
  pricingModel: 'tiered' | 'water';
  totalAmount: number;
  location: string;
  store?: string;
  packaging?: string;
  waterBags?: number;
  waterFee?: number;
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled';
  taskerId?: string;
  taskerName?: string;
  acceptedBy?: string;
  acceptedAt?: Date;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  hasPaid: boolean;
  updatedAt: Date;
  taskerHasPaid:boolean;
  paymentProvider?: 'flutterwave';
  paymentStatus: 'unpaid' | 'initialized' | 'paid' | 'failed' | 'cancelled';
  paymentReference?: string;
  paymentLink?: string;
  paymentTransactionId?: string;
  paymentInitializedAt?: Date;
  paymentVerifiedAt?: Date;
  paymentFailureReason?: string;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    taskType: {
      type: String,
      required: true,
      enum: ['restaurant', 'printing', 'shopping', 'water', 'others'],
    },
    description: {
      type: String,
      required: false,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      default: 0,
    },
    taskerFee: {
      type: Number,
      required: true,
      default: 0,
    },
    serviceFee: {
      type: Number,
      required: true,
      default: 0,
    },
    pricingModel: {
      type: String,
      enum: ['tiered', 'water'],
      required: true,
      default: 'tiered',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      required: true,
    },
    taskerHasPaid: {
      type: Boolean,
      default: false,
    },
    store: String,
    packaging: String,
    waterBags: {
      type: Number,
      min: 1,
    },
    waterFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'paid', 'completed', 'cancelled'],
      default: 'pending',
    },
    taskerId: {
      type: String,
      index: true,
    },
    acceptedBy: {
      type: String,
      index: true,
    },
    acceptedAt: Date,
    paidAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    hasPaid: {
      type: Boolean,
      default: false
    },
    taskerName: String,
    paymentProvider: {
      type: String,
      enum: ['flutterwave'],
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'initialized', 'paid', 'failed', 'cancelled'],
      default: 'unpaid',
    },
    paymentReference: String,
    paymentLink: String,
    paymentTransactionId: String,
    paymentInitializedAt: Date,
    paymentVerifiedAt: Date,
    paymentFailureReason: String,
  },
  { timestamps: true }
);



export const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
