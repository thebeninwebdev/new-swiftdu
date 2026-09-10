import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ExcoDashboardLoader } from "@/components/exco-dashboard-loader";
import { getExcoAccess } from "@/lib/exco";

export const metadata: Metadata = {
  title: "SwiftDU CFO Dashboard",
  description: "Finance dashboard for SwiftDU executive leadership.",
};

export default async function CfoDashboardPage() {
  const access = await getExcoAccess(await headers());

  if (!access.isAuthenticated) redirect("/auth");
  if (access.excoRole !== "CFO") redirect("/dashboard");

  return <ExcoDashboardLoader role="CFO" />;
}
