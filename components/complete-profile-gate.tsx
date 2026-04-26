"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  buildCompleteProfilePath,
  isProfileComplete,
} from "@/lib/profile-completion";

export function CompleteProfileGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const queryString = searchParams.toString();
  const nextPath = `${pathname}${queryString ? `?${queryString}` : ""}`;

  useEffect(() => {
    if (isPending || !user || isProfileComplete(user)) {
      return;
    }

    router.replace(buildCompleteProfilePath(nextPath));
  }, [isPending, nextPath, router, user]);

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-slate-500">
        Loading your account...
      </div>
    );
  }

  if (user && !isProfileComplete(user)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-slate-500">
        Taking you to the last step of account setup...
      </div>
    );
  }

  return <>{children}</>;
}
