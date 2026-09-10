import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Operations suspended',
  robots: { index: false, follow: false },
}

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-lg text-center">
        <Image
          src="/logo.png?v=swiftdu-symbol-v1"
          alt="SwiftDU"
          width={512}
          height={512}
          priority
          className="mx-auto mb-8 h-24 w-24 object-contain"
        />
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Operations are currently suspended
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">
          SwiftDU is temporarily unavailable. Please check back later.
          Thank you for your patience.
        </p>
      </section>
    </main>
  )
}
