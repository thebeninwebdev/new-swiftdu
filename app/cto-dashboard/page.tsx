import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ExcoDashboardLoader } from "@/components/exco-dashboard-loader";
import { getExcoAccess } from "@/lib/exco";

export const metadata: Metadata = {
  title: "SwiftDU CTO Dashboard",
  description: "Technology dashboard for SwiftDU executive leadership.",
};

export default async function CtoDashboardPage() {
  const access = await getExcoAccess(await headers());

  if (!access.isAuthenticated) redirect("/login");
  if (access.excoRole !== "CTO") redirect("/dashboard");

  return <ExcoDashboardLoader role="CTO" />;
}
