import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { isBusinessAdmin } from "@/lib/business-admin";
import { uploadBusinessImage, deleteBusinessImage } from "@/lib/business-image";
import Business from "@/models/business";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    if (!(await isBusinessAdmin(req.headers)))
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await context.params;
    if (!isValidObjectId(id)) return new NextResponse(null, { status: 404 });
    await connectDB();
    const business = await Business.findById(id).select(
      "+pendingImage +pendingImageMime",
    );
    if (!business?.pendingImage) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(business.pendingImage), {
      headers: {
        "Content-Type": business.pendingImageMime || "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
export async function PATCH(req: NextRequest, context: Context) {
  let uploadedId: string | undefined;
  try {
    if (!(await isBusinessAdmin(req.headers)))
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await context.params;
    if (!isValidObjectId(id))
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
    const action = body?.action;
    if (!["approve", "reject", "hide", "restore"].includes(action))
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    await connectDB();
    const business = await Business.findById(id).select(
      "+pendingImage +pendingImageMime",
    );
    if (!business)
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    const update: Record<string, unknown> = {};
    if (action === "approve") {
      if (business.status !== "review" || !business.pendingImage)
        return NextResponse.json(
          { error: "Only review listings with an image can be approved." },
          { status: 409 },
        );
      // Unique upload ID makes competing admin actions safe to clean up independently.
      uploadedId = `swiftdu-businesses/${id}-${crypto.randomUUID()}`;
      Object.assign(
        update,
        await uploadBusinessImage(business.pendingImage, uploadedId),
        { status: "approved", isVisible: true },
      );
    } else if (action === "reject")
      Object.assign(update, {
        status: "rejected",
        isVisible: false,
        rejectionReason: "Rejected after SwiftDU review.",
      });
    else {
      if (business.status !== "approved")
        return NextResponse.json(
          { error: "Only approved listings can be hidden or restored." },
          { status: 409 },
        );
      update.isVisible = action === "restore";
    }
    const result = await Business.updateOne(
      { _id: id, updatedAt: business.updatedAt },
      {
        $set: update,
        ...(action === "approve" || action === "reject"
          ? { $unset: { pendingImage: 1, pendingImageMime: 1 } }
          : {}),
      },
    );
    if (!result.modifiedCount) {
      if (uploadedId) await deleteBusinessImage(uploadedId);
      return NextResponse.json(
        { error: "Listing changed. Refresh and try again." },
        { status: 409 },
      );
    }
    uploadedId = undefined;
    return NextResponse.json({ success: true });
  } catch {
    if (uploadedId)
      try {
        await deleteBusinessImage(uploadedId);
      } catch {
        console.error(
          "[PATCH /api/admin/businesses] image cleanup failed",
          uploadedId,
        );
      }
    console.error("[PATCH /api/admin/businesses] failed");
    return NextResponse.json(
      {
        code: "UPLOAD_FAILED",
        error: "Unable to update listing. Please try again.",
      },
      { status: 503 },
    );
  }
}
