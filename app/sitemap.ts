import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

const publicRoutes = [
  "/",
  "/about-us",
  "/contact-us",
  "/reviews",
  "/signup",
  "/tasker-signup",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return publicRoutes.map((route, index) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
