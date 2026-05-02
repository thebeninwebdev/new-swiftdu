"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const HIDDEN_CHROME_PREFIXES = [
  "/admin",
  "/cfo-dashboard",
  "/cmo-dashboard",
  "/coo-dashboard",
  "/cto-dashboard",
  "/dashboard",
  "/login",
  "/signup",
  "/tasker-dashboard",
  "/tasker-signup",
];

export function ChromeVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidden = HIDDEN_CHROME_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (hidden) {
    return null;
  }

  return children;
}
