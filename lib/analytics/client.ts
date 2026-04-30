"use client";

const VISITOR_COOKIE = "swiftdu_visitor_id";
const VISITOR_STORAGE_KEY = "swiftdu.visitorId";
const LAST_TRACK_STORAGE_KEY = "swiftdu.lastAnalyticsTrack";
const TRACK_DEBOUNCE_MS = 15_000;
const SKIPPED_PATH_PREFIXES = [
  "/api",
  "/admin",
  "/dashboard/analytics",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/sw.js",
];

type TrackPayload = {
  visitorId: string;
  page: string;
  referrer?: string;
  eventName?: string;
};

declare global {
  interface Window {
    swiftduAnalytics?: {
      track: (eventName: string, page?: string) => void;
    };
  }
}

function isAnalyticsEnabled() {
  const host = window.location.hostname;

  return (
    process.env.NODE_ENV === "production" &&
    host !== "localhost" &&
    host !== "127.0.0.1"
  );
}

function shouldSkipPath(page: string) {
  const pathname = page.split("?")[0] || "/";
  return SKIPPED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function writeVisitorCookie(visitorId: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${VISITOR_COOKIE}=${visitorId}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

function createVisitorId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateVisitorId() {
  const cookieVisitorId = readCookie(VISITOR_COOKIE);
  if (cookieVisitorId) {
    localStorage.setItem(VISITOR_STORAGE_KEY, cookieVisitorId);
    return cookieVisitorId;
  }

  const storedVisitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (storedVisitorId) {
    writeVisitorCookie(storedVisitorId);
    return storedVisitorId;
  }

  const visitorId = createVisitorId();
  localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  writeVisitorCookie(visitorId);
  return visitorId;
}

function recentlyTracked(page: string, eventName = "page_view") {
  const now = Date.now();
  const raw = sessionStorage.getItem(LAST_TRACK_STORAGE_KEY);

  if (!raw) {
    sessionStorage.setItem(
      LAST_TRACK_STORAGE_KEY,
      JSON.stringify({ page, eventName, trackedAt: now })
    );
    return false;
  }

  try {
    const lastTrack = JSON.parse(raw) as {
      page?: string;
      eventName?: string;
      trackedAt?: number;
    };
    const isDuplicate =
      lastTrack.page === page &&
      lastTrack.eventName === eventName &&
      typeof lastTrack.trackedAt === "number" &&
      now - lastTrack.trackedAt < TRACK_DEBOUNCE_MS;

    sessionStorage.setItem(
      LAST_TRACK_STORAGE_KEY,
      JSON.stringify({ page, eventName, trackedAt: now })
    );

    return isDuplicate;
  } catch {
    sessionStorage.setItem(
      LAST_TRACK_STORAGE_KEY,
      JSON.stringify({ page, eventName, trackedAt: now })
    );
    return false;
  }
}

export function trackAnalyticsEvent(payload: TrackPayload) {
  if (!isAnalyticsEnabled()) {
    return;
  }

  if (shouldSkipPath(payload.page)) {
    return;
  }

  if (recentlyTracked(payload.page, payload.eventName)) {
    return;
  }

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics/track",
      new Blob([body], { type: "application/json" })
    );
    return;
  }

  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
