export const DEFAULT_SITE_URL = "https://swiftdu.org";
const ADSENSE_PUBLISHER_ID = "4657526411072658";

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function getConfiguredUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    normalizeUrl(process.env.BASE_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeUrl(process.env.BETTER_AUTH_URL);
}

// Preview deployments always use their own immutable deployment host. This must
// take precedence over production-scoped variables inherited by a Vercel build.
function getVercelDeploymentUrl() {
  return normalizeUrl(process.env.VERCEL_URL);
}

export function getSiteUrl() {
  if (process.env.VERCEL_ENV === "preview") {
    const deploymentUrl = getVercelDeploymentUrl();
    if (!deploymentUrl) throw new Error("VERCEL_URL is required for Vercel Preview deployments.");
    return deploymentUrl;
  }

  const configured = getConfiguredUrl();
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return DEFAULT_SITE_URL;
}

export function getAuthBaseUrl() {
  const url = new URL(getSiteUrl());
  if (process.env.NODE_ENV !== "production" && url.hostname === "0.0.0.0") {
    url.hostname = "localhost";
  }
  return url.origin;
}


export function getTrustedOrigins() {
  const origins = new Set<string>()
  const isPreview = process.env.VERCEL_ENV === "preview"
  const isLocal = process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV

  if (isPreview) {
    // VERCEL_URL is platform-provided; never derive trust from a request header.
    origins.add(getAuthBaseUrl())
  } else if (isLocal) {
    origins.add("http://localhost:3000")
    origins.add(getAuthBaseUrl())
  } else {
    origins.add(DEFAULT_SITE_URL)
    origins.add("https://www.swiftdu.org")
    origins.add(getAuthBaseUrl())
  }

  return [...origins]
}
export const siteUrl = getSiteUrl();
export const adsenseAccount = `ca-pub-${ADSENSE_PUBLISHER_ID}`;
export const adsenseScriptSrc =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseAccount}`;
export const adsenseAdsTxtEntry =
  `google.com, pub-${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`;