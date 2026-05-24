import { Expenditure, type ExpenditureApprovalRole } from "@/models/expenditure";

export async function getApprovedExpenditureTotal(match: Record<string, unknown> = {}) {
  const [summary] = await Expenditure.aggregate<{ _id: null; total: number }>([
    {
      $match: {
        status: "approved",
        ...match,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  return summary?.total || 0;
}

export function getPendingApprovalRoles(input: {
  requiredApprovals: ExpenditureApprovalRole[];
  approvals: Array<{ role: ExpenditureApprovalRole }>;
}) {
  const approvedRoles = new Set(input.approvals.map((approval) => approval.role));
  return input.requiredApprovals.filter((role) => !approvedRoles.has(role));
}
