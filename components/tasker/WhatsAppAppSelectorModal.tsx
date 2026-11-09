'use client'

import { useState } from 'react'
import { MessageCircle, Check, Smartphone, Briefcase, ExternalLink, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { WhatsAppAppPreference } from '@/lib/whatsapp/links'

interface WhatsAppAppSelectorModalProps {
  open: boolean
  onClose: () => void
  onSelectApp: (app: 'whatsapp' | 'whatsapp_business' | 'web', remember: boolean) => void
  currentPreference?: WhatsAppAppPreference
  title?: string
  description?: string
}

export function WhatsAppAppSelectorModal({
  open,
  onClose,
  onSelectApp,
  currentPreference = 'ask_every_time',
  title = 'Choose WhatsApp App',
  description = 'Select which app to open for sending this message.',
}: WhatsAppAppSelectorModalProps) {
  const [selectedApp, setSelectedApp] = useState<'whatsapp' | 'whatsapp_business' | 'web'>(
    currentPreference === 'whatsapp_business'
      ? 'whatsapp_business'
      : currentPreference === 'whatsapp'
      ? 'whatsapp'
      : 'whatsapp'
  )
  const [rememberPreference, setRememberPreference] = useState(
    currentPreference !== 'ask_every_time'
  )

  const handleConfirm = () => {
    onSelectApp(selectedApp, rememberPreference)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl p-6 sm:p-7">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <MessageCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="mt-3 text-center text-xl font-extrabold text-slate-900 dark:text-white">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2.5">
          {/* WhatsApp Messenger */}
          <button
            type="button"
            onClick={() => setSelectedApp('whatsapp')}
            className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
              selectedApp === 'whatsapp'
                ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:border-emerald-700 dark:bg-emerald-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  WhatsApp Messenger
                </p>
                <p className="text-xs text-slate-500">Regular WhatsApp personal app</p>
              </div>
            </div>
            {selectedApp === 'whatsapp' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            )}
          </button>

          {/* WhatsApp Business */}
          <button
            type="button"
            onClick={() => setSelectedApp('whatsapp_business')}
            className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
              selectedApp === 'whatsapp_business'
                ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:border-emerald-700 dark:bg-emerald-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  WhatsApp Business
                </p>
                <p className="text-xs text-slate-500">Business account app</p>
              </div>
            </div>
            {selectedApp === 'whatsapp_business' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            )}
          </button>

          {/* Standard Web / Default */}
          <button
            type="button"
            onClick={() => setSelectedApp('web')}
            className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
              selectedApp === 'web'
                ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:border-emerald-700 dark:bg-emerald-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Standard Link / System Default
                </p>
                <p className="text-xs text-slate-500">Universal wa.me web link</p>
              </div>
            </div>
            {selectedApp === 'web' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            )}
          </button>
        </div>

        {/* Remember choice toggle */}
        <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberPreference}
              onChange={(e) => setRememberPreference(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Remember my choice for future messages
            </span>
          </label>
        </div>

        <DialogFooter className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Open App
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
