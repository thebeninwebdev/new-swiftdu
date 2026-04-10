import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import {Toaster} from "sonner"
import NavbarClientWrapper from "@/components/NavbarClientWrapper";
import Wrapper from "@/components/wrapper";
import { Footer } from "@/components/Footer";

function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!envUrl) {
    return "https://swiftdu.vercel.app";
  }

  return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
}

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Swiftdu | Campus errands made easy",
    template: "%s | Swiftdu",
  },
  description:
    "Swiftdu connects students with trusted campus runners for food delivery, shopping, printing, pickups, and everyday campus errands.",
  applicationName: "Swiftdu",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
