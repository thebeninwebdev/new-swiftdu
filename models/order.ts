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
  pricingModel: 'tiered' | 'water' | 'copy_notes';
  totalAmount: number;
  requiresPremiumTasker: boolean;
  location: string;
  store?: string;
  packaging?: string;
  waterBags?: number;
  waterFee?: number;
  copyNotesType?: 'hardback' | 'small';
  copyNotesPages?: number;
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled';
  taskerId?: string;
  taskerName?: string;
  acceptedBy?: string;
  bookedAt?: Date;
  acceptedAt?: Date;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  hasPaid: boolean;
  updatedAt: Date;
  taskerHasPaid: boolean;
  isDeclinedTask: boolean;
  declinedAt?: Date;
  declinedReason?: 'transaction_not_found' | 'other';
  declinedMessage?: string;
  declinedByTaskerAt?: Date;
  paymentProvider?: 'flutterwave' | 'manual_transfer';
  paymentStatus: 'unpaid' | 'initialized' | 'paid' | 'failed' | 'cancelled';
  paymentReference?: string;
  paymentLink?: string;
  paymentTransactionId?: string;
  paymentInitializedAt?: Date;
  paymentVerifiedAt?: Date;
  paymentFailureReason?: string;
  customerTransferredAt?: Date;
  settlementProvider?: 'paystack' | 'flutterwave';
  settlementStatus: 'not_due' | 'pending' | 'initialized' | 'paid' | 'failed' | 'overdue';
  settlementReference?: string;
  settlementAccessCode?: string;
  settlementCheckoutUrl?: string;
  settlementTransactionId?: string;
  settlementInitializedAt?: Date;
  settlementPaidAt?: Date;
  settlementDueAt?: Date;
  settlementFailureReason?: string;
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
      enum: ['restaurant', 'printing', 'shopping', 'water', 'others', 'copy_notes'],
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
      enum: ['tiered', 'water', 'copy_notes'],
      required: true,
      default: 'tiered',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    requiresPremiumTasker: {
      type: Boolean,
      default: false,
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
    copyNotesType: {
      type: String,
      enum: ['hardback', 'small'],
    },
    copyNotesPages: {
      type: Number,
      min: 1,
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
    bookedAt: {
      type: Date,
      default: Date.now,
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
    isDeclinedTask: {
      type: Boolean,
      default: false,
      index: true,
    },
    declinedAt: Date,
    declinedReason: {
      type: String,
      enum: ['transaction_not_found', 'other'],
    },
    declinedMessage: String,
    declinedByTaskerAt: Date,
    taskerName: String,
    paymentProvider: {
      type: String,
      enum: ['flutterwave', 'manual_transfer'],
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
    customerTransferredAt: Date,
    settlementProvider: {
      type: String,
      enum: ['paystack', 'flutterwave'],
    },
    settlementStatus: {
      type: String,
      enum: ['not_due', 'pending', 'initialized', 'paid', 'failed', 'overdue'],
      default: 'not_due',
    },
    settlementReference: String,
    settlementAccessCode: String,
    settlementCheckoutUrl: String,
    settlementTransactionId: String,
    settlementInitializedAt: Date,
    settlementPaidAt: Date,
    settlementDueAt: Date,
    settlementFailureReason: String,
  },
  { timestamps: true }
);



export const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
