'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { isChromeHiddenPath } from './ChromeVisibility'
import { MobilePushFrame } from './mobile-push-frame'

const Navbar = dynamic(() => import('./Navbar').then((module) => module.Navbar))
const PublicMobileMenu = dynamic(() => import('./Navbar').then((module) => module.PublicMobileMenu))
const Footer = dynamic(() => import('./Footer').then((module) => module.Footer))

export function PublicNavigationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((current) => !current), [])

  useEffect(() => {
    const frame = requestAnimationFrame(close)
    return () => cancelAnimationFrame(frame)
  }, [pathname, close])

  if (isChromeHiddenPath(pathname)) return children

  return (
    <MobilePushFrame open={open} verticalScale={0.99} className="public-push-root" onClose={close} menuId="public-mobile-menu" menu={<PublicMobileMenu onClose={close} />} pageClassName="bg-white">
      <Navbar isOpen={open} onToggle={toggle} onClose={close} />
      {children}
      <Footer />
    </MobilePushFrame>
  )
}
