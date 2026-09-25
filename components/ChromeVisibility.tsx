"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const HIDDEN_CHROME_PREFIXES = [
  "/suspended",
  "/admin",
  "/cfo-dashboard",
  "/cmo-dashboard",
  "/coo-dashboard",
  "/cto-dashboard",
  "/dashboard",
  "/tasks",
  "/auth",
  "/login",
  "/signup",
  "/complete-profile",
  "/dry-cleaner-signup",
  "/tasker-dashboard",
  "/tasker-signup",
];

export function ChromeVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidden = isChromeHiddenPath(pathname);

  if (hidden) {
    return null;
  }

  return children;
}

export function isChromeHiddenPath(pathname: string) {
  return HIDDEN_CHROME_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
