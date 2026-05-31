import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  userId: string;
  trackingToken?: string;
  source?: 'website' | 'whatsapp';
  customerPhone?: string;
  customerName?: string;
  taskType: string;
  description?: string;
  amount: number;
  itemPrice?: number;
  commission: number;
  platformFee: number;
  taskerFee: number;
  serviceFee: number;
  pricingModel: 'tiered' | 'water' | 'copy_notes';
  totalAmount: number;
  location: string;
  deliveryLocation?: string;
  store?: string;
  packaging?: string;
  restaurantPeopleCount?: number;
  restaurantTakeawayCount?: number;
  restaurantPackagingFee?: number;
  cafeInquiry?: boolean;
  cafeInquiryFeePaid?: boolean;
  cafeInquiryDetailsSubmitted?: boolean;
  waterBags?: number;
  waterFee?: number;
  noteSize?: 'small' | 'big';
  numberOfPages?: number;
  printingServiceType?: 'printing' | 'photocopying';
  printingNeedsEditing?: boolean;
  drawingPages?: number;
  deadline?: Date;
  dueDate?: Date;
  copyNotesType?: 'big' | 'small' | 'hardback';
  copyNotesPages?: number;
  deadlineDate?: Date;
  deadlineValue?: number;
  deadlineUnit?: 'mins' | 'hours' | 'days';
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
    trackingToken: {
      type: String,
      index: {
        unique: true,
        sparse: true,
      },
    },
    source: {
      type: String,
      enum: ['website', 'whatsapp'],
      default: 'website',
      index: true,
    },
    customerPhone: {
      type: String,
      index: true,
    },
    customerName: String,
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
    itemPrice: {
      type: Number,
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
    location: {
      type: String,
      required: true,
    },
    deliveryLocation: String,
    taskerHasPaid: {
      type: Boolean,
      default: false,
    },
    store: String,
    packaging: String,
    restaurantPeopleCount: {
      type: Number,
      min: 1,
    },
    restaurantTakeawayCount: {
      type: Number,
      min: 0,
    },
    restaurantPackagingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    cafeInquiry: {
      type: Boolean,
      default: false,
      index: true,
    },
    cafeInquiryFeePaid: {
      type: Boolean,
      default: false,
    },
    cafeInquiryDetailsSubmitted: {
      type: Boolean,
      default: false,
    },
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
      enum: ['big', 'small', 'hardback'],
    },
    copyNotesPages: {
      type: Number,
      min: 1,
    },
    noteSize: {
      type: String,
      enum: ['small', 'big'],
      required: function (this: IOrder) {
        return this.taskType === 'copy_notes';
      },
    },
    numberOfPages: {
      type: Number,
      min: 1,
      required: function (this: IOrder) {
        return this.taskType === 'copy_notes';
      },
    },
    printingServiceType: {
      type: String,
      enum: ['printing', 'photocopying'],
    },
    printingNeedsEditing: {
      type: Boolean,
      default: false,
    },
    drawingPages: {
      type: Number,
      min: 0,
      required: function (this: IOrder) {
        return this.taskType === 'copy_notes';
      },
    },
    deadline: {
      type: Date,
      required: function (this: IOrder) {
        return this.taskType === 'copy_notes';
      },
    },
    dueDate: {
      type: Date,
      required: function (this: IOrder) {
        return this.taskType === 'copy_notes';
      },
    },
    deadlineDate: Date,
    deadlineValue: {
      type: Number,
      min: 1,
    },
    deadlineUnit: {
      type: String,
      enum: ['mins', 'hours', 'days'],
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
