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
    <div className="lg:flex min-h-screen">
      <DashboardMenu />
      <main className="min-w-0 flex-1 pt-20 lg:pt-0">
        {children}
      </main>
    </div>
  );
}