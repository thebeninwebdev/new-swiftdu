import DashboardMenu from '@/components/dashboard-menu';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Esefabrics- Admin page',
  description: 'Manage and monitor your site with every click',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
    <DashboardMenu />
        <main className='py-20'>
              {children}
        </main>
        </>
  );
}