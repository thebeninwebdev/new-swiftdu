import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeferredAppScripts } from "@/components/DeferredAppScripts";
import { PublicNavigationShell } from "@/components/public-navigation-shell";
import { adsenseAccount, siteUrl } from "@/lib/site";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Swiftdu | Campus errands made easy",
    template: "%s | Swiftdu",
  },
  description:
    "Swiftdu connects students with trusted campus runners for food delivery, shopping, printing, pickups, and everyday campus errands.",
  applicationName: "Swiftdu",
  manifest: "/manifest.webmanifest",
  category: "productivity",
  icons: {
    icon: [
      { url: "/favicon.ico?v=swiftdu-symbol-v1", sizes: "256x256", type: "image/x-icon" },
      { url: "/icon.png?v=swiftdu-symbol-v1", sizes: "256x256", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png?v=swiftdu-symbol-v1", sizes: "256x256", type: "image/png" }],
  },
  keywords: [
    "Swiftdu",
    "campus errands",
    "student delivery",
    "campus runner",
    "food delivery",
    "shopping",
    "printing services",
    "Western Delta University",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Swiftdu | Campus errands made easy",
    description:
      "Swiftdu connects students with trusted campus runners for food delivery, shopping, printing, pickups, and everyday campus errands.",
    url: "/",
    siteName: "Swiftdu",
    images: [
      {
        url: "/opengraph-image.png?v=swiftdu-symbol-v1",
        width: 1200,
        height: 630,
        alt: "Swiftdu",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swiftdu | Campus errands made easy",
    description:
      "Swiftdu connects students with trusted campus runners for food delivery, shopping, printing, pickups, and everyday campus errands.",
    images: ["/opengraph-image.png?v=swiftdu-symbol-v1"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Swiftdu",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content={adsenseAccount} />
      </head>
      <body
        className={`${manrope.className} antialiased tracking-wide`}
      >
        <PublicNavigationShell>{children}</PublicNavigationShell>
        <DeferredAppScripts />
      </body>
    </html>
  );
}
