import type { Metadata, Viewport } from "next";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import {Toaster} from "sonner"
import NavbarClientWrapper from "@/components/NavbarClientWrapper";
import Wrapper from "@/components/wrapper";
import { Footer } from "@/components/Footer";
import { adsenseAccount, adsenseScriptSrc, siteUrl } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next"

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
        <script async src={adsenseScriptSrc} crossOrigin="anonymous"></script>
      </head>
      <body
        className="antialiased tracking-wide"
      >
        <NextTopLoader color="#2563eb" height={2} showSpinner={false} />
        <Wrapper path="/dashboard">
        <Wrapper path="/tasker-signup">
        <Wrapper path="/signup">
        <Wrapper path="/login">
        <Wrapper path="/admin">
        <Wrapper path="/tasker-dashboard">
          <NavbarClientWrapper />
        </Wrapper></Wrapper>
        </Wrapper>
        </Wrapper>
        </Wrapper>
        </Wrapper>
        <Analytics />
        {children}
        <Wrapper path="/dashboard">
        <Wrapper path="/tasker-signup">
        <Wrapper path="/signup">
        <Wrapper path="/admin">
        <Wrapper path="/tasker-dashboard">
          <Footer />
        </Wrapper></Wrapper>
        </Wrapper>
        </Wrapper>
        </Wrapper>
           
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
