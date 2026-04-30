"use client";

import { useCallback } from "react";
import { getOrCreateVisitorId, trackAnalyticsEvent } from "@/lib/analytics/client";

export function useAnalytics() {
  return useCallback((eventName: string, page?: string) => {
    const visitorId = getOrCreateVisitorId();
    trackAnalyticsEvent({
      visitorId,
      page: page || `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer,
      eventName,
    });
  }, []);
}
