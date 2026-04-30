import { NextResponse, type NextRequest } from "next/server";

import {
  EXCO_DASHBOARD_PATHS,
  EXCO_ROLE_LABELS,
  getExcoAccess,
} from "@/lib/exco";

export async function GET(request: NextRequest) {
  const access = await getExcoAccess(request.headers);

  if (!access.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!access.excoRole) {
    return NextResponse.json({ excoRole: null });
  }

  return NextResponse.json({
    excoRole: access.excoRole,
    label: EXCO_ROLE_LABELS[access.excoRole],
    dashboardPath: EXCO_DASHBOARD_PATHS[access.excoRole],
  });
}
