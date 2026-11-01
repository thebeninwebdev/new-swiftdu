export function getGiveawayAllowedOrigins(
  configured = process.env.GIVEAWAY_ALLOWED_ORIGINS,
) {
  return (configured || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => {
      if (!origin) return false;
      try {
        return new URL(origin).origin === origin;
      } catch {
        return false;
      }
    });
}

export function isGiveawayOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
  development = process.env.NODE_ENV !== "production",
) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (!development) return false;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

const giveawayRealtimeConfig = {
  getGiveawayAllowedOrigins,
  isGiveawayOriginAllowed,
};

export default giveawayRealtimeConfig;
