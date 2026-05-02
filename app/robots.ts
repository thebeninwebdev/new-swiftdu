import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/dashboard",
          "/login",
          "/password",
          "/reset-password",
          "/signup",
          "/tasker-dashboard",
          "/tasker-signup",
          "/verify-2fa",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
