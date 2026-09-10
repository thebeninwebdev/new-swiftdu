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
        <div className="min-h-screen overflow-x-hidden lg:flex">
          <DashboardMenu />
          <main className="min-w-0 flex-1 bg-linear-to-br from-[#f7f9fc] via-white to-[#eef7ff] pt-20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 lg:bg-transparent lg:pt-0">
            {children}
          </main>
        </div>
    </Suspense>
  );
}
