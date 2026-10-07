import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Business from "@/models/business";
import {
  escapeBusinessSearch,
  exactDuplicateReason,
  fuzzyDuplicateLevel,
  calculateNameSimilarity,
  createBusinessSlug,
  publicBusinessDTO,
  validateBusinessInput,
  type PublicBusiness,
} from "@/lib/business-directory";
import {
  reviewBusiness,
  businessReviewModel,
  type DuplicateCandidate,
} from "@/lib/business-ai-review";
import { moderateBusinessSubmission } from "@/lib/business-submission";
import { validateBusinessImage } from "@/lib/business-image-validation";
import {
  uploadBusinessImage,
  deleteBusinessImage,
} from "@/lib/business-image-storage";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (code: string, error: string, status: number) =>
  NextResponse.json({ code, error }, { status });
const publicSelection =
  "businessName ownerName description productsServices category imageUrl phone whatsapp instagram email location slug createdAt";
function duplicate(
  existing?: {
    status?: string | null;
    isVisible?: boolean | null;
    businessName: string;
    slug: string;
  },
  reason = "These business details have already been submitted.",
) {
  return NextResponse.json(
    {
      code: "BUSINESS_ALREADY_EXISTS",
      error: "This business appears to already be listed on SwiftDU.",
      reason,
      ...(existing?.status === "approved" && existing.isVisible
        ? {
            existingBusiness: {
              name: existing.businessName,
              slug: existing.slug,
              url: `/businesses?listing=${encodeURIComponent(existing.slug)}`,
            },
          }
        : {}),
    },
    { status: 409 },
  );
}
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const page = Math.max(
      1,
      Math.min(10000, Number.parseInt(params.get("page") || "1") || 1),
    );
    const limit = Math.max(
      1,
      Math.min(24, Number.parseInt(params.get("limit") || "21") || 21),
    );
    const query = params.get("q")?.trim().slice(0, 100),
      category = params.get("category")?.slice(0, 60),
      slug = params.get("listing")?.slice(0, 150);
    const filter: Record<string, unknown> = {
      status: "approved",
      isVisible: true,
    };
    if (query)
      filter.$or = [
        "businessName",
        "category",
        "description",
        "productsServices",
      ].map((key) => ({
        [key]: { $regex: escapeBusinessSearch(query), $options: "i" },
      }));
    if (category) filter.category = category;
    if (slug) filter.slug = slug;
    await connectDB();
    const [businesses, total] = await Promise.all([
      Business.find(filter)
        .select(publicSelection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Business.countDocuments(filter),
    ]);
    return NextResponse.json(
      {
        businesses: businesses.map((b) =>
          publicBusinessDTO({
            ...b,
            createdAt: b.createdAt.toISOString(),
          } as PublicBusiness),
        ),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[GET /api/businesses]",
      error instanceof Error ? error.name : "Error",
    );
    return fail(
      "DIRECTORY_UNAVAILABLE",
      "The directory could not load. Please try again.",
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  let recordId: Types.ObjectId | undefined;
  let uploadId: string | undefined;
  let stage = "database";
  try {
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
      return fail(
        "VALIDATION_ERROR",
        "Submit the listing as a form with one image.",
        400,
      );
    // Bound the entire stream, including requests without a Content-Length header.
    const reader = req.body?.getReader();
    if (!reader) return fail("VALIDATION_ERROR", "Submission is empty.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2300000) {
        await reader.cancel();
        return fail("IMAGE_INVALID", "Use one image up to 2 MB.", 413);
      }
      chunks.push(value);
    }
    let form: FormData;
    try {
      form = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": req.headers.get("content-type")! },
      }).formData();
    } catch {
      return fail("VALIDATION_ERROR", "Invalid submission form.", 400);
    }
    let input;
    try {
      input = validateBusinessInput(form);
    } catch (error) {
      return fail("VALIDATION_ERROR", (error as Error).message, 400);
    }
    const files = [...form.values()].filter((v) => v instanceof File);
    const file = form.get("image");
    if (!(file instanceof File) || files.length !== 1)
      return fail(
        "IMAGE_INVALID",
        "Upload one JPEG, PNG or WebP image up to 2 MB.",
        400,
      );
    let imageData;
    try {
      imageData = await validateBusinessImage(file);
    } catch {
      return fail(
        "IMAGE_INVALID",
        "Use a valid JPEG, PNG or WebP image up to 2 MB.",
        400,
      );
    }
    await connectDB();
    // Ensure unique indexes before accepting concurrent anonymous submissions.
    await Business.init();
    const contacts = [input.normalizedPhone, input.normalizedWhatsapp];
    const existing = await Business.findOne({
      $or: [
        { normalizedBusinessName: input.normalizedBusinessName },
        { normalizedPhone: { $in: contacts } },
        { normalizedWhatsapp: { $in: contacts } },
        ...(input.normalizedInstagram
          ? [{ normalizedInstagram: input.normalizedInstagram }]
          : []),
      ],
    }).lean();
    if (existing)
      return duplicate(
        existing,
        exactDuplicateReason(input, existing) ?? undefined,
      );
    const candidates: (DuplicateCandidate & { score: number })[] = [];
    // Stream names rather than loading the directory into memory or sending it to Gemini.
    for await (const b of Business.find({
      status: { $in: ["approved", "review"] },
    })
      .select(
        "businessName description category location productsServices slug status isVisible",
      )
      .lean()
      .cursor()) {
      const level = fuzzyDuplicateLevel(input.businessName, b.businessName);
      if (level === "duplicate")
        return duplicate(
          b,
          "A very similar business name has already been submitted.",
        );
      if (level === "candidate") {
        candidates.push({
          id: String(b._id),
          businessName: b.businessName,
          description: b.description,
          category: b.category,
          location: b.location ?? "",
          productsServices: b.productsServices,
          score: calculateNameSimilarity(input.businessName, b.businessName),
        });
        candidates.sort((a, b) => b.score - a.score);
        candidates.splice(5);
      }
    }
    const { outcome, review, error: moderationError } = await moderateBusinessSubmission(
      input,
      imageData.image,
      imageData.mimeType,
      candidates.map((c) => ({
        id: c.id,
        businessName: c.businessName,
        description: c.description,
        category: c.category,
        location: c.location,
        productsServices: c.productsServices,
      })),
      reviewBusiness,
    );
    if (outcome === "unavailable" || !review)
      return fail(
        "MODERATION_UNAVAILABLE",
        moderationError || "Automatic safety checks are temporarily unavailable. Please try again shortly.",
        503,
      );
    if (review && outcome === "duplicate")
      return duplicate(
        (await Business.findById(review.duplicateCandidateId).lean()) ??
          undefined,
      );
    if (review && outcome === "reject")
      return fail(
        "BUSINESS_NOT_ALLOWED",
        "This listing cannot be added because it does not meet the SwiftDU Business Directory policy.",
        422,
      );
    if (outcome !== "approve")
      return fail(
        "BUSINESS_CHECKS_INCOMPLETE",
        "Your listing could not pass automatic checks. Please clarify your business details and use a relevant, non-sexual logo or product photo, then submit again.",
        422,
      );
    recordId = new Types.ObjectId();
    // Reserve unique name/contact keys before uploading; the reservation is never public.
    const business = await Business.create({
      ...input,
      _id: recordId,
      contactKeys: [...new Set(contacts)],
      slug: createBusinessSlug(input.businessName, recordId.toString()),
      status: "review",
      isVisible: false,
      ...(review
        ? {
            moderation: {
              ...review,
              model: businessReviewModel(),
              reviewedAt: new Date(),
            },
            category: review.category,
          }
        : {}),
      pendingImage: imageData.image,
      pendingImageMime: imageData.mimeType,
    });
    uploadId = `swiftdu-businesses/${recordId}`;
    stage = "image_upload";
    const uploaded = await uploadBusinessImage(imageData.image, uploadId);
    business.set({
      ...uploaded,
      status: "approved",
      isVisible: true,
      pendingImage: undefined,
      pendingImageMime: undefined,
    });
    stage = "database_save";
    await business.save();
    return NextResponse.json(
      { message: "Your business is now listed ðŸŽ‰", slug: business.slug },
      { status: 201 },
    );
  } catch (error) {
    // Delete only this request's uncommitted reservation, never another submission.
    if (recordId) {
      try {
        await Business.deleteOne({
          _id: recordId,
          status: "review",
        });
      } catch {
        console.error("[POST /api/businesses] reservation cleanup failed");
      }
      if (uploadId)
        try {
          await deleteBusinessImage(uploadId);
        } catch {
          console.error(
            "[POST /api/businesses] image cleanup failed",
            uploadId,
          );
        }
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    )
      return duplicate();
    console.error(
      "[POST /api/businesses]",
      { stage, error: error instanceof Error ? error.name : "Error" },
    );
    return fail(
      stage === "image_upload" ? "UPLOAD_FAILED" : "SUBMISSION_UNAVAILABLE",
      stage === "image_upload"
        ? "Your business image could not be uploaded. Please try again shortly."
        : "Your listing could not be saved to the directory. Please try again shortly.",
      503,
    );
  }
}
