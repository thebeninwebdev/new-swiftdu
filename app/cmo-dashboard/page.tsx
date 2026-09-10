import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ExcoDashboardLoader } from "@/components/exco-dashboard-loader";
import { getExcoAccess } from "@/lib/exco";

export const metadata: Metadata = {
  title: "SwiftDU CMO Dashboard",
  description: "Marketing and analytics dashboard for SwiftDU executive leadership.",
};

export default async function CmoDashboardPage() {
  const access = await getExcoAccess(await headers());

  if (!access.isAuthenticated) redirect("/auth");
  if (access.excoRole !== "CMO") redirect("/dashboard");

  return <ExcoDashboardLoader role="CMO" />;
}
