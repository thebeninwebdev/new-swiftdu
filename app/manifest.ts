import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  const siteUrl = getSiteUrl();

  return {
    name: "Swiftdu",
    short_name: "Swiftdu",
    description:
      "Campus errands made easy with trusted student runners for deliveries, shopping, printing, and everyday pickups.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111827",
    categories: ["productivity", "lifestyle", "education"],
    lang: "en-NG",
    id: siteUrl,
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
  };
}
