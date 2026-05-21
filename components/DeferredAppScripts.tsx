"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DeferredTopLoader = dynamic(() => import("nextjs-toploader"), {
  ssr: false,
});

const DeferredToaster = dynamic(
  () => import("sonner").then((module) => module.Toaster),
  { ssr: false }
);

const DeferredVercelAnalytics = dynamic(
  () => import("@vercel/analytics/next").then((module) => module.Analytics),
  { ssr: false }
);

const DeferredGoogleAnalytics = dynamic(
  () => import("@/components/google-analytics").then((module) => module.GoogleAnalytics),
  { ssr: false }
);

const DeferredAnalyticsTracker = dynamic(
  () => import("@/components/analytics-tracker").then((module) => module.AnalyticsTracker),
  { ssr: false }
);

const DeferredAdsenseLoader = dynamic(
  () => import("@/components/AdsenseLoader").then((module) => module.AdsenseLoader),
  { ssr: false }
);

function onIdle(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let timeoutId: number | undefined;
  let idleId: number | undefined;

  const requestIdleCallback = window.requestIdleCallback;
  const cancelIdleCallback = window.cancelIdleCallback;

  if (requestIdleCallback) {
    idleId = requestIdleCallback(callback, { timeout: 2500 });
  } else {
    timeoutId = window.setTimeout(callback, 1800);
  }

  return () => {
    if (idleId && cancelIdleCallback) {
      cancelIdleCallback(idleId);
    }

    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  };
}

export function DeferredAppScripts() {
  const [ready, setReady] = useState(false);

  useEffect(() => onIdle(() => setReady(true)), []);

  if (!ready) {
    return null;
  }

  return (
    <>
      <DeferredTopLoader color="#2563eb" height={2} showSpinner={false} />
      <DeferredVercelAnalytics />
      <DeferredGoogleAnalytics />
      <DeferredAnalyticsTracker />
      <DeferredAdsenseLoader />
      <DeferredToaster richColors position="bottom-right" />
    </>
  );
}
