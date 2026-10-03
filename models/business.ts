import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const businessSchema = new Schema(
  {
    businessName: { type: String, required: true, maxlength: 80 },
    normalizedBusinessName: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 400 },
    productsServices: [String],
    category: { type: String, required: true, index: true },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    phone: { type: String, required: true },
    normalizedPhone: { type: String, required: true, index: true },
    whatsapp: { type: String, required: true },
    normalizedWhatsapp: { type: String, required: true, index: true },
    // A unique multikey index also prevents phone/WhatsApp cross-field races.
    contactKeys: { type: [String], required: true, select: false },
    email: String,
    instagram: String,
    normalizedInstagram: { type: String, unique: true, sparse: true },
    location: String,
    status: {
      type: String,
      enum: ["approved", "rejected", "review"],
      default: "review",
      index: true,
    },
    isVisible: { type: Boolean, default: false },
    slug: { type: String, required: true, unique: true },
    moderation: {
      decision: String,
      confidence: Number,
      appearsGenuine: Boolean,
      imageRelevant: Boolean,
      imageSafe: Boolean,
      category: String,
      reasons: [String],
      flags: [String],
      duplicateCandidateId: String,
      duplicateConfidence: Number,
      duplicateDecision: String,
      model: String,
      reviewedAt: Date,
    },
    rejectionReason: String,
    // Private review image; removed on approval/rejection. Never selected by public queries.
    pendingImage: { type: Buffer, select: false },
    pendingImageMime: { type: String, select: false },
  },
  { timestamps: true },
);
businessSchema.index({ contactKeys: 1 }, { unique: true });
businessSchema.index({ createdAt: -1 });
businessSchema.index({ status: 1, isVisible: 1, category: 1, createdAt: -1 });
type BusinessDocument = InferSchemaType<typeof businessSchema>;
const Business =
  (models.Business as Model<BusinessDocument>) ||
  model("Business", businessSchema);
export default Business;
