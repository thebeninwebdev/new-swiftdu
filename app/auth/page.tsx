import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthEntry } from "@/components/auth-entry";

export const metadata: Metadata = {
  title: "Continue to SwiftDU",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return <Suspense><AuthEntry /></Suspense>;
}
