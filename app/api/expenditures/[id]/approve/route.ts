import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getExcoAccess } from "@/lib/exco";
import { getPendingApprovalRoles } from "@/lib/expenditures";
import {
  Expenditure,
  type ExpenditureApprovalRole,
  type IExpenditureApproval,
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
    createdByName: expenditure.createdByName || "",
    approvedAt: expenditure.approvedAt?.toISOString?.() || null,
    createdAt: expenditure.createdAt?.toISOString?.() || null,
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
    };
  }

  if (excoAccess.excoRole) {
    return {
      userId: session.user.id,
      name,
      approvalRole: excoAccess.excoRole as ExpenditureApprovalRole,
    };
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request);

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const expenditure = await Expenditure.findById(id);

  if (!expenditure) {
    return NextResponse.json({ error: "Expenditure not found." }, { status: 404 });
  }

  if (expenditure.status === "approved") {
    return NextResponse.json({ item: serializeExpenditure(expenditure) });
  }

  if (!expenditure.requiredApprovals.includes(actor.approvalRole)) {
    return NextResponse.json({ error: "You cannot approve this expenditure." }, { status: 403 });
  }

  const alreadyApproved = expenditure.approvals.some(
    (approval: IExpenditureApproval) => approval.role === actor.approvalRole
  );

  if (!alreadyApproved) {
    expenditure.approvals.push({
      role: actor.approvalRole,
      approvedBy: actor.userId,
      approvedByName: actor.name,
      approvedAt: new Date(),
    });
  }

  const pendingRoles = getPendingApprovalRoles({
    requiredApprovals: expenditure.requiredApprovals,
    approvals: expenditure.approvals,
  });

  if (pendingRoles.length === 0) {
    expenditure.status = "approved";
    expenditure.approvedAt = new Date();
  }

  await expenditure.save();

  return NextResponse.json({ item: serializeExpenditure(expenditure) });
}
