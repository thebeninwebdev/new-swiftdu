import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const PUBLIC_SITE_URL = 'https://www.swiftdu.org'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const url = `${PUBLIC_SITE_URL}/tasker-dashboard/accept-order/${encodeURIComponent(id)}`
  const title = 'SwiftDU Order'
  const description = 'A SwiftDU task is available. Tap to accept this order.'

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'SwiftDU',
      images: [{ url: `${PUBLIC_SITE_URL}/opengraph-image.png?v=swiftdu-symbol-v1` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${PUBLIC_SITE_URL}/opengraph-image.png?v=swiftdu-symbol-v1`],
    },
  }
}

export default function AcceptOrderLayout({ children }: { children: ReactNode }) {
  return children
}
