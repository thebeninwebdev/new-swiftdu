import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  importScripts: ["/sw-push.js"],
  cacheStartUrl: false,
  dynamicStartUrl: false,
  runtimeCaching: require("./pwa/runtime-caching"),
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/logo.png",
        search: "?v=20260826",
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

export default withPWA(nextConfig);
