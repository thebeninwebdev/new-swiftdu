import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import ExcoDashboard from "@/components/exco-dashboard";
import { getExcoAccess } from "@/lib/exco";

export const metadata: Metadata = {
  title: "SwiftDU CMO Dashboard",
  description: "Marketing and analytics dashboard for SwiftDU executive leadership.",
};

export default async function CmoDashboardPage() {
  const access = await getExcoAccess(await headers());

  if (!access.isAuthenticated) redirect("/login");
  if (access.excoRole !== "CMO") redirect("/dashboard");

  return <ExcoDashboard role="CMO" />;
}
