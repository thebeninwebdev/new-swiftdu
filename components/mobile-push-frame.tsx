'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

type MobilePushFrameProps = {
  open: boolean
  onClose: () => void
  menuId: string
  menu: ReactNode
  children: ReactNode
  className?: string
  pageClassName?: string
  menuClassName?: string
  verticalScale?: number
}

export function MobilePushFrame({ open, onClose, menuId, menu, children, className = '', pageClassName = '', menuClassName = '', verticalScale = 0.94 }: MobilePushFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (open) rootRef.current?.style.setProperty('--mobile-push-counter-y', `${window.scrollY * (1 - verticalScale)}px`)
  }, [open, verticalScale])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const onDesktop = () => { if (desktop.matches) onClose() }
    window.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onDesktop)
    }
  }, [open, onClose])

  return (
    <div ref={rootRef} className={`mobile-push-root ${className}`} data-menu-open={open}>
      <div id={menuId} className={`mobile-push-menu ${menuClassName}`} aria-hidden={!open} inert={!open}>{menu}</div>
      <div className={`mobile-push-page ${pageClassName}`}>
        <div className="contents" inert={open}>{children}</div>
        {open ? <button type="button" aria-label="Close navigation menu" onClick={onClose} className="mobile-push-close" /> : null}
      </div>
    </div>
  )
}
