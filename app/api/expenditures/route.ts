import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getExcoAccess } from "@/lib/exco";
import { getPendingApprovalRoles } from "@/lib/expenditures";
import {
  Expenditure,
  EXPENDITURE_REQUIRED_APPROVALS,
  type ExpenditureApprovalRole,
} from "@/models/expenditure";
import { User } from "@/models/user";

function serializeExpenditure(expenditure: any) {
  return {
    id: expenditure._id.toString(),
    title: expenditure.title,
    amount: expenditure.amount,
    category: expenditure.category,
    notes: expenditure.notes || "",
    status: expenditure.status,
    requiredApprovals: expenditure.requiredApprovals,
    approvals: expenditure.approvals || [],
    pendingApprovals: getPendingApprovalRoles({
      requiredApprovals: expenditure.requiredApprovals,
      approvals: expenditure.approvals || [],
    }),
    createdBy: expenditure.createdBy,
    createdByName: expenditure.createdByName || "",
    approvedAt: expenditure.approvedAt?.toISOString?.() || null,
    createdAt: expenditure.createdAt?.toISOString?.() || null,
    updatedAt: expenditure.updatedAt?.toISOString?.() || null,
  };
}

async function getActor(request: NextRequest) {
  const [excoAccess, session] = await Promise.all([
    getExcoAccess(request.headers),
    auth.api.getSession({ headers: request.headers }),
  ]);

  if (!session?.user?.id) {
    return null;
  }

  await connectDB();

  const dbUser = await User.findById(session.user.id)
    .select("name email role")
    .lean<{ name?: string; email?: string; role?: string }>();

  const name = dbUser?.name || session.user.name || session.user.email || "SwiftDU executive";

  if (dbUser?.role === "admin" || session.user.role === "admin") {
    return {
      userId: session.user.id,
      name,
      approvalRole: "CEO" as ExpenditureApprovalRole,
      excoRole: excoAccess.excoRole,
      isAdmin: true,
    };
  }

  if (excoAccess.excoRole) {
    return {
      userId: session.user.id,
      name,
      approvalRole: excoAccess.excoRole as ExpenditureApprovalRole,
      excoRole: excoAccess.excoRole,
      isAdmin: false,
    };
  }

  return null;
}

export async function GET(request: NextRequest) {
  const actor = await getActor(request);

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 25), 1), 100);
  const status = request.nextUrl.searchParams.get("status");

  const query = status === "pending" || status === "approved" ? { status } : {};
  const expenditures = await Expenditure.find(query)
    .sort({ status: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    items: expenditures.map(serializeExpenditure),
    actorRole: actor.approvalRole,
  });
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);

  if (!actor || actor.approvalRole !== "CFO") {
    return NextResponse.json({ error: "Only the CFO can add expenditures." }, { status: 403 });
  }

  const body = await request.json();
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const amount = Number(body?.amount);

  if (!title || !category || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Title, category, and a valid amount are required." },
      { status: 400 }
    );
  }

  const expenditure = await Expenditure.create({
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    notes: notes || undefined,
    status: "pending",
    requiredApprovals: EXPENDITURE_REQUIRED_APPROVALS,
    approvals: [
      {
        role: "CFO",
        approvedBy: actor.userId,
        approvedByName: actor.name,
        approvedAt: new Date(),
      },
    ],
    createdBy: actor.userId,
    createdByName: actor.name,
  });

  return NextResponse.json({ item: serializeExpenditure(expenditure) }, { status: 201 });
}
