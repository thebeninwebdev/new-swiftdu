import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TelegramConnect } from './telegram-connect'

export const metadata: Metadata = {
  title: 'Connect Telegram | SwiftDU',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function TelegramConnectPage() {
  return <Suspense><TelegramConnect /></Suspense>
}
