import type { NextConfig } from "next";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: true,
  cacheOnNavigation: false,
  reloadOnOnline: false,
  // A fresh build replaces the fallback even when HEAD has not changed.
  additionalPrecacheEntries: [
    { url: "/offline", revision: randomUUID() },
    ...["logo.png", "pwa-192x192.png", "pwa-512x512.png", "apple-icon.png"].map((file) => ({
      url: "/" + file,
      revision: createHash("sha256").update(readFileSync("public/" + file)).digest("hex"),
    })),
  ],
  // Exclude pages, RSC, API data, arbitrary public files and old workers.
  manifestTransforms: [async (entries) => ({
    manifest: entries.filter(({ url }) =>
      url === "/offline" ||
      /^\/_next\/static\/.*\.(?:js|css|woff2?|ttf|otf)$/.test(url) ||
      /^\/(?:logo(?:-white)?|pwa-192x192|pwa-512x512|apple-icon)\.png$/.test(url)
    ),
    warnings: [],
  })],
});

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/mascot/**",
      },
      {
        pathname: "/logo.png",
        search: "?v=swiftdu-symbol-v1",
      },
      {
        pathname: "/sign-up.jpg",
      },
      {
        pathname: "/sign-up.png",
      },
      {
        pathname: "/support.jpeg",
      },
      {
        pathname: "/earn.jpeg",
      },
      {
        pathname: "/learn.jpeg",
      },
      {
        pathname: "/tasker-signup.jpg",
      },
      {
        pathname: "/Western_Delta_University.jpg",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default withSerwist(nextConfig);
