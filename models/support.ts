import mongoose, { Schema, Document } from "mongoose";

export interface ISupport extends Document {
  taskerId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: "technical" | "payment" | "order" | "safety" | "other";
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  adminResponse?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SupportSchema = new Schema<ISupport>(
  {
    taskerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Tasker",
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: ["technical", "payment", "order", "safety", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    adminResponse: {
      type: String,
      maxlength: 2000,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Support ||
  mongoose.model<ISupport>("Support", SupportSchema);
