import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isBusinessAdmin } from "@/lib/business-admin";
import Business from "@/models/business";
export async function GET(req: NextRequest) {
  try {
    if (!(await isBusinessAdmin(req.headers)))
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await connectDB();
    const status = req.nextUrl.searchParams.get("status") || "review";
    const page = Math.max(
      1,
      Number.parseInt(req.nextUrl.searchParams.get("page") || "1") || 1,
    );
    const filter =
      status === "hidden"
        ? { status: "approved", isVisible: false }
        : {
            status: ["approved", "rejected", "review"].includes(status)
              ? status
              : "review",
            ...(status === "approved" ? { isVisible: true } : {}),
          };
    const [businesses, total] = await Promise.all([
      Business.find(filter)
        .select(
          "-normalizedBusinessName -normalizedPhone -normalizedWhatsapp -normalizedInstagram",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * 20)
        .limit(20)
        .lean(),
      Business.countDocuments(filter),
    ]);
    return NextResponse.json(
      { businesses, pages: Math.ceil(total / 20) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[GET /api/admin/businesses] failed");
    return NextResponse.json(
      { error: "Unable to load businesses." },
      { status: 500 },
    );
  }
}
