import { auth } from "@/lib/auth";
import { normalizeExcoRole } from "@/lib/exco-constants";
export async function isBusinessAdmin(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return Boolean(
    session?.user &&
    (session.user.role === "admin" ||
      normalizeExcoRole(
        (session.user as { excoRole?: string | null }).excoRole,
      )),
  );
}
