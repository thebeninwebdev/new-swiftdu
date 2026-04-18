const DEFAULT_SITE_URL = "https://swiftdu.vercel.app";
const ADSENSE_PUBLISHER_ID = "4657526411072658";

function normalizeUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = trimmed.startsWith("http")
    ? trimmed
    : `https://${trimmed}`;

  return withProtocol.replace(/\/$/, "");
}

function isLocalUrl(value: string) {
  try {
    const { hostname } = new URL(value);

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return true;
  }
}

function getPublicSiteUrl(value?: string | null) {
  const normalizedUrl = normalizeUrl(value);

  if (!normalizedUrl || isLocalUrl(normalizedUrl)) {
    return null;
  }

  return normalizedUrl;
}

export function getSiteUrl() {
  return (
    getPublicSiteUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    getPublicSiteUrl(process.env.BASE_URL) ||
    getPublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    getPublicSiteUrl(process.env.BETTER_AUTH_URL) ||
    getPublicSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    getPublicSiteUrl(process.env.VERCEL_URL) ||
    DEFAULT_SITE_URL
  );
}

export const siteUrl = getSiteUrl();
export const adsenseAccount = `ca-pub-${ADSENSE_PUBLISHER_ID}`;
export const adsenseScriptSrc =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseAccount}`;
export const adsenseAdsTxtEntry =
  `google.com, pub-${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`;
