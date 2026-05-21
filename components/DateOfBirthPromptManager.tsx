'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'

import { authClient } from '@/lib/auth-client'

export function DateOfBirthPromptManager() {
  const { data: session, isPending } = authClient.useSession()
  const [showPrompt, setShowPrompt] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isPending || !session?.user?.id) {
      return
    }

    let cancelled = false

    const loadDateOfBirth = async () => {
      try {
        const response = await fetch('/api/users/me/date-of-birth', {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as {
          dateOfBirth?: string | null
        }

        if (!cancelled) {
          setDateOfBirth(payload.dateOfBirth || '')
          setShowPrompt(!payload.dateOfBirth)
        }
      } catch (loadError) {
        console.warn('[Date of Birth Prompt]:', loadError)
      }
    }

    void loadDateOfBirth()

    return () => {
      cancelled = true
    }
  }, [isPending, session?.user?.id])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      const response = await fetch('/api/users/me/date-of-birth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateOfBirth }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(payload.error || 'Failed to save birthday.')
        return
      }

      setShowPrompt(false)
    } catch {
      setError('Failed to save birthday.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/35 px-3 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">What is your birthday?</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  This helps us keep your Swiftdu account details complete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                aria-label="Dismiss birthday prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Birthday
            </label>
            <input
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900"
              required
            />
            {error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={isSaving}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {isSaving ? 'Saving...' : 'Save birthday'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
