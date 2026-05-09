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
  /* config options here */
};

export default withPWA(nextConfig);
