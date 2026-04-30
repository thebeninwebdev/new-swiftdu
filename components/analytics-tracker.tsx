"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getOrCreateVisitorId, trackAnalyticsEvent } from "@/lib/analytics/client";

function AnalyticsPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const queryString = searchParams.toString();
    const page = queryString ? `${pathname}?${queryString}` : pathname;
    const visitorId = getOrCreateVisitorId();

    window.swiftduAnalytics = {
      track: (eventName: string, customPage?: string) => {
        trackAnalyticsEvent({
          visitorId,
          page: customPage || `${window.location.pathname}${window.location.search}`,
          referrer: document.referrer,
          eventName,
        });
      },
    };

    trackAnalyticsEvent({
      visitorId,
      page,
      referrer: document.referrer,
    });
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPageTracker />
    </Suspense>
  );
}
