import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ChromeVisibility } from "@/components/ChromeVisibility";
import { DeferredAppScripts } from "@/components/DeferredAppScripts";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { adsenseAccount, siteUrl } from "@/lib/site";

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
        url: "/opengraph-image.png",
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
    images: ["/opengraph-image.png"],
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
        className="antialiased tracking-wide"
      >
        <ChromeVisibility>
          <Navbar />
        </ChromeVisibility>
        {children}
        <ChromeVisibility>
          <Footer />
        </ChromeVisibility>
        <DeferredAppScripts />
      </body>
    </html>
  );
}
