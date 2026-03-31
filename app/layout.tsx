import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import {Toaster} from "sonner"
import NavbarClientWrapper from "@/components/NavbarClientWrapper";
import Wrapper from "@/components/wrapper";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://swiftdu.org"),
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
    url: "https://swiftdu.org",
    siteName: "Swiftdu",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swiftdu | Campus errands made easy",
    description:
      "Swiftdu connects students with trusted campus runners for food delivery, shopping, printing, pickups, and everyday campus errands.",
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
        className={`${geistSans.className} antialiased tracking-wide`}
      >
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
