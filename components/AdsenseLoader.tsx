"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { adsenseScriptSrc } from "@/lib/site";

const ADSENSE_CONTENT_ROUTES = new Set([
  "/",
  "/about-us",
  "/contact-us",
  "/reviews",
  "/terms",
]);

export function AdsenseLoader() {
  const pathname = usePathname();

  if (!ADSENSE_CONTENT_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <Script
      src={adsenseScriptSrc}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
