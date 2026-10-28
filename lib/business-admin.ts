import { getAdminDashboardAccess } from "@/lib/admin-access";

export async function isBusinessAdmin(headers: Headers) {
  return Boolean(await getAdminDashboardAccess(headers));
}
