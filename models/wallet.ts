import mongoose, { Schema, Document } from "mongoose";

export interface IWallet extends Document {
  taskerId: mongoose.Types.ObjectId;
  totalEarnings: number;
  currentBalance: number;
  totalWithdrawn: number;
  transactions: Array<{
    type: "credit" | "debit";
    amount: number;
    description: string;
    orderId?: mongoose.Types.ObjectId;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    taskerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Tasker",
      index: true,
      unique: true,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ["credit", "debit"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        description: {
          type: String,
          required: true,
        },
        orderId: {
          type: Schema.Types.ObjectId,
          ref: "Order",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Wallet ||
  mongoose.model<IWallet>("Wallet", WalletSchema);
