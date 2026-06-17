import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ExcoDashboardLoader } from "@/components/exco-dashboard-loader";
import { getExcoAccess } from "@/lib/exco";

export const metadata: Metadata = {
  title: "SwiftDU COO Dashboard",
  description: "Operations dashboard for SwiftDU executive leadership.",
};

export default async function CooDashboardPage() {
  const access = await getExcoAccess(await headers());

  if (!access.isAuthenticated) redirect("/login");
  if (access.excoRole !== "COO") redirect("/dashboard");

  return <ExcoDashboardLoader role="COO" />;
}
