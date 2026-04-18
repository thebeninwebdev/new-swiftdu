'use client'

import type { CSSProperties } from 'react'
import { useEffect } from 'react'

import { adsenseAccount } from '@/lib/site'

interface AdBannerProps {
  slot: string
  className?: string
  format?: string
  fullWidthResponsive?: boolean
  style?: CSSProperties
}

export default function AdBanner({
  slot,
  className,
  format = 'auto',
  fullWidthResponsive = true,
  style,
}: AdBannerProps) {
  useEffect(() => {
    if (!slot) {
      return
    }

    try {
      // @ts-ignore
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (err) {
      console.error(err)
    }
  }, [slot])

  if (!slot) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('AdBanner requires a valid AdSense slot ID.')
    }

    return null
  }

  return (
    <ins
      className={className ? `adsbygoogle ${className}` : 'adsbygoogle'}
      style={{ display: 'block', ...style }}
      data-ad-client={adsenseAccount}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
    />
  )
}
