"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const queryString = searchParams.toString();
  const nextPath = `${pathname}${queryString ? `?${queryString}` : ""}`;
  const isComplete = Boolean(user && isProfileComplete(user) && hasPassword === true);

  useEffect(() => {
    if (!user) {
      setHasPassword(null);
      return;
    }

    if (isPending) {
      return;
    }

    let ignore = false;

    async function loadPasswordStatus() {
      try {
        const response = await fetch("/api/users/me/password-status", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!ignore) {
          setHasPassword(response.ok ? Boolean(payload.hasPassword) : false);
        }
      } catch {
        if (!ignore) {
          setHasPassword(false);
        }
      }
    }

    void loadPasswordStatus();

    return () => {
      ignore = true;
    };
  }, [isPending, user]);

  useEffect(() => {
    if (isPending || !user || hasPassword === null || isComplete) {
      return;
    }

    router.replace(buildCompleteProfilePath(nextPath));
  }, [hasPassword, isComplete, isPending, nextPath, router, user]);

  if (isPending || (user && hasPassword === null)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-slate-500">
        Loading your account...
      </div>
    );
  }

  if (user && !isComplete) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-slate-500">
        Taking you to the last step of account setup...
      </div>
    );
  }

  return <>{children}</>;
}
