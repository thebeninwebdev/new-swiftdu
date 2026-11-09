'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Check, Loader2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import type { WhatsAppAppPreference } from '@/lib/whatsapp/links'

export function WhatsAppPreferenceControl({ className = '' }: { className?: string }) {
  const [preference, setPreference] = useState<WhatsAppAppPreference>('ask_every_time')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPreference = useCallback(async () => {
    try {
      const res = await fetch('/api/taskers/preferences', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.whatsappAppPreference) {
        setPreference(data.whatsappAppPreference)
      }
    } catch {
      // Best-effort load
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPreference()
  }, [fetchPreference])

  const handleSelect = async (pref: WhatsAppAppPreference) => {
    if (saving || pref === preference) return
    const prev = preference
    setPreference(pref)
    setSaving(true)

    try {
      const res = await fetch('/api/taskers/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappAppPreference: pref }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update WhatsApp preference')
      }

      toast.success(
        pref === 'whatsapp'
          ? 'Default app set to WhatsApp Messenger'
          : pref === 'whatsapp_business'
          ? 'Default app set to WhatsApp Business'
          : 'Will ask you every time before opening WhatsApp'
      )
    } catch (err: any) {
      setPreference(prev)
      toast.error(err.message || 'Failed to update WhatsApp preference')
    } finally {
      setSaving(false)
    }
  }

  const options: Array<{
    value: WhatsAppAppPreference
    title: string
    description: string
    badge?: string
  }> = [
    {
      value: 'ask_every_time',
      title: 'Ask Every Time',
      description: 'Choose between WhatsApp Messenger and Business each time you message.',
      badge: 'Recommended',
    },
    {
      value: 'whatsapp',
      title: 'WhatsApp Messenger',
      description: 'Always open regular WhatsApp Messenger directly.',
    },
    {
      value: 'whatsapp_business',
      title: 'WhatsApp Business',
      description: 'Always open WhatsApp Business directly.',
    },
  ]

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <MessageCircle className="h-4 w-4" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              WhatsApp Application Preference
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose which WhatsApp application opens when contacting customers for tasks.
          </p>
        </div>
        {saving && <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />}
      </div>

      <div className="mt-5 space-y-3">
        {options.map((opt) => {
          const isSelected = preference === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={loading || saving}
              onClick={() => handleSelect(opt.value)}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {opt.title}
                  </span>
                  {opt.badge && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{opt.description}</p>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
