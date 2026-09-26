'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export function WorkDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose?.() }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[2rem] border border-violet-100 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
    {children}
  </dialog>
}
