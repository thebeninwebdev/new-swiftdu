import mongoose, { Schema, Document } from "mongoose";

export type ExpenditureApprovalRole = "CFO" | "CMO" | "COO" | "CTO" | "CEO";
export type ExpenditureStatus = "pending" | "approved";

export interface IExpenditureApproval {
  role: ExpenditureApprovalRole;
  approvedBy: string;
  approvedByName?: string;
  approvedAt: Date;
}

export interface IExpenditure extends Document {
  title: string;
  amount: number;
  category: string;
  notes?: string;
  status: ExpenditureStatus;
  requiredApprovals: ExpenditureApprovalRole[];
  approvals: IExpenditureApproval[];
  createdBy: string;
  createdByName?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const EXPENDITURE_REQUIRED_APPROVALS: ExpenditureApprovalRole[] = [
  "CFO",
  "CMO",
  "COO",
  "CTO",
  "CEO",
];

const approvalSchema = new Schema<IExpenditureApproval>(
  {
    role: {
      type: String,
      enum: EXPENDITURE_REQUIRED_APPROVALS,
      required: true,
    },
    approvedBy: {
      type: String,
      required: true,
    },
    approvedByName: String,
    approvedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const expenditureSchema = new Schema<IExpenditure>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
      index: true,
    },
    requiredApprovals: {
      type: [String],
      enum: EXPENDITURE_REQUIRED_APPROVALS,
      default: EXPENDITURE_REQUIRED_APPROVALS,
      required: true,
    },
    approvals: {
      type: [approvalSchema],
      default: [],
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    createdByName: String,
    approvedAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

export const Expenditure =
  mongoose.models.Expenditure ||
  mongoose.model<IExpenditure>("Expenditure", expenditureSchema);
