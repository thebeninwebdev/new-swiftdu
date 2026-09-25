import { Suspense } from 'react';
import DashboardMenu from '@/components/dashboard-menu';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SwiftDU - Dashboard page',
  description: 'Manage and monitor your errands with every click',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-slate-500">
          Loading your dashboard...
        </div>
      }
    >
        <DashboardMenu>{children}</DashboardMenu>
    </Suspense>
  );
}
