import { redirect } from "next/navigation";
import { getLegacyAuthRedirect } from "@/lib/auth-redirect";

export default async function LoginRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(getLegacyAuthRedirect(await searchParams));
}
