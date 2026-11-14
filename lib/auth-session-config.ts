export const AUTH_SESSION_SETTINGS = {
  expiresIn: 60 * 60 * 24 * 30,
  updateAge: 60 * 60 * 24,
} as const;

export function getAuthCookieAttributes(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function getCrossSubdomainCookieConfig(authBaseUrl: string, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== "production") return null;
  const hostname = new URL(authBaseUrl).hostname;
  if (hostname !== "swiftdu.org" && hostname !== "www.swiftdu.org") return null;
  return { enabled: true as const, domain: "swiftdu.org" };
}

export const SESSION_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  Vary: "Cookie",
} as const;
