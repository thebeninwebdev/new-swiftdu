"use client"

import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import type { getProfileCompletion } from "@/lib/profile-completion"

type ProfileCompletion = ReturnType<typeof getProfileCompletion>

interface ProfileResponse {
  completion: ProfileCompletion
}

export function ProfileCompletionCard() {
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadCompletion() {
      try {
        const response = await fetch("/api/users/me/profile", { cache: "no-store" })
        if (!response.ok) return

        const payload = (await response.json()) as ProfileResponse
        if (isMounted) {
          setCompletion(payload.completion)
        }
      } catch {
        if (isMounted) {
          setCompletion(null)
        }
      }
    }

    void loadCompletion()
    window.addEventListener("swiftdu-profile-updated", loadCompletion)

    return () => {
      isMounted = false
      window.removeEventListener("swiftdu-profile-updated", loadCompletion)
    }
  }, [])

  if (!completion) {
    return null
  }

  const missingLabels = completion.missingFields.map((item) => item.label)

  return (
    <Card className="mb-5 border-indigo-100 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/20">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Profile completion
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {completion.percentage === 100
                ? "Your profile is complete."
                : `Missing: ${missingLabels.slice(0, 3).join(", ")}${missingLabels.length > 3 ? "..." : ""}`}
            </p>
          </div>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">
            {completion.percentage}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900">
          <div
            className="h-full rounded-full bg-linear-to-r from-indigo-600 to-cyan-500 transition-all"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
