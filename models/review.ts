import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
  taskerId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    taskerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Tasker",
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Order",
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "user",
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

export const Review =  mongoose.models.Review ||
  mongoose.model<IReview>("Review", ReviewSchema);