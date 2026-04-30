import type { NextRequest } from "next/server";
import { geolocation, ipAddress as vercelIpAddress } from "@vercel/functions";

const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|uptime|monitor|pingdom|headless|curl|wget|python-requests|scrapy|facebookexternalhit|slurp|semrush|ahrefs/i;

const INTERNAL_PATH_PREFIXES = [
  "/api",
  "/admin",
  "/dashboard/analytics",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/sw.js",
  "/workbox-",
];

export type ClientInfo = {
  browser: string;
  os: string;
  device: string;
};

export function isBotUserAgent(userAgent: string) {
  return !userAgent || BOT_USER_AGENT_PATTERN.test(userAgent);
}

export function shouldSkipAnalyticsPath(pathname: string) {
  return INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function normalizePage(input: string) {
  try {
    const url = input.startsWith("http")
      ? new URL(input)
      : new URL(input, "https://swiftdu.local");

    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

export function normalizeReferrer(referrer?: string) {
  if (!referrer) {
    return "Direct";
  }

  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, "") || "Direct";
  } catch {
    return "Direct";
  }
}

export function getRequestLocation(request: NextRequest) {
  const geo = geolocation(request);
  const country =
    geo.country ||
    request.headers.get("x-vercel-ip-country") ||
    "Unknown";
  const city =
    geo.city ||
    request.headers.get("x-vercel-ip-city") ||
    "Unknown";

  return {
    country: decodeURIComponent(country),
    city: decodeURIComponent(city),
  };
}

export function getRequestIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const fallbackIp = forwardedFor?.split(",")[0]?.trim();

  return (
    vercelIpAddress(request) ||
    request.headers.get("x-real-ip") ||
    fallbackIp ||
    "Unknown"
  );
}

export function parseUserAgent(userAgent: string): ClientInfo {
  const source = userAgent.toLowerCase();

  const browser = source.includes("edg/")
    ? "Edge"
    : source.includes("opr/") || source.includes("opera")
      ? "Opera"
      : source.includes("chrome/")
        ? "Chrome"
        : source.includes("safari/") && !source.includes("chrome/")
          ? "Safari"
          : source.includes("firefox/")
            ? "Firefox"
            : source.includes("msie") || source.includes("trident/")
              ? "Internet Explorer"
              : "Unknown";

  const os = source.includes("windows")
    ? "Windows"
    : source.includes("android")
      ? "Android"
      : source.includes("iphone") || source.includes("ipad") || source.includes("ios")
        ? "iOS"
        : source.includes("mac os") || source.includes("macintosh")
          ? "macOS"
          : source.includes("linux")
            ? "Linux"
            : "Unknown";

  const device = source.includes("ipad") || source.includes("tablet")
    ? "Tablet"
    : source.includes("mobi") || source.includes("iphone") || source.includes("android")
      ? "Mobile"
      : "Desktop";

  return { browser, os, device };
}

export function isProductionAnalyticsRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return false;
  }

  const host = request.headers.get("host") || "";
  return !host.includes("localhost") && !host.startsWith("127.0.0.1");
}
