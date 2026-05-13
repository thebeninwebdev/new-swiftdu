"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, ChevronRight, Sparkles, UserCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { getProfileCompletion } from "@/lib/profile-completion"

type ProfileCompletion = ReturnType<typeof getProfileCompletion>

interface ProfileResponse {
  completion: ProfileCompletion
}

export function ProfileCompletionCard() {
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [animatedPercentage, setAnimatedPercentage] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function loadCompletion() {
      try {
        const response = await fetch("/api/users/me/profile", {
          cache: "no-store",
        })
        if (!response.ok) return

        const payload = (await response.json()) as ProfileResponse
        if (isMounted) {
          setCompletion(payload.completion)
          // Trigger entrance animation
          setTimeout(() => setIsVisible(true), 50)
          // Animate percentage counter
          const target = payload.completion.percentage
          const duration = 1000
          const steps = 30
          const increment = target / steps
          let current = 0
          const timer = setInterval(() => {
            current += increment
            if (current >= target) {
              setAnimatedPercentage(target)
              clearInterval(timer)
            } else {
              setAnimatedPercentage(Math.floor(current))
            }
          }, duration / steps)
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

  if (!completion || completion.percentage >= 100) {
    return null
  }

  const missingLabels = completion.missingFields.map((item) => item.label)
  const isHighCompletion = completion.percentage >= 80
  const isMediumCompletion = completion.percentage >= 50 && completion.percentage < 80

  return (
    <div
      className={cn(
        "mb-5 transform transition-all duration-700 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <Link
        href="/dashboard/profile-completion"
        className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <Card
          className={cn(
            "relative cursor-pointer overflow-hidden border-0 shadow-lg transition-all duration-500",
            "hover:shadow-xl hover:scale-[1.02] active:scale-[0.99]",
            isHighCompletion
              ? "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/30"
              : isMediumCompletion
                ? "bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30"
                : "bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-purple-950/40"
          )}
        >
          {/* Animated background decoration */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-3xl transition-all duration-700 group-hover:bg-white/20" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-all duration-700 group-hover:bg-white/20" />

          <CardContent className="relative space-y-4 p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                    isHighCompletion
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
                      : isMediumCompletion
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                        : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400"
                  )}
                >
                  {isHighCompletion ? (
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  ) : (
                    <UserCircle className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Profile completion
                    {isHighCompletion && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                        Almost there!
                      </span>
                    )}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Missing:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {missingLabels.slice(0, 2).join(", ")}
                    </span>
                    {missingLabels.length > 2 && (
                      <span className="text-slate-400">
                        {" "}
                        +{missingLabels.length - 2} more
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Percentage with circular indicator */}
              <div className="flex flex-col items-end gap-1">
                <div className="relative">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${completion.percentage}, 100`}
                      className={cn(
                        "transition-all duration-1000 ease-out",
                        isHighCompletion
                          ? "text-emerald-500"
                          : isMediumCompletion
                            ? "text-amber-500"
                            : "text-indigo-500"
                      )}
                    />
                  </svg>
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center text-sm font-bold",
                      isHighCompletion
                        ? "text-emerald-700 dark:text-emerald-300"
                        : isMediumCompletion
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-indigo-700 dark:text-indigo-300"
                    )}
                  >
                    {animatedPercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Linear progress bar */}
            <div className="space-y-2">
              <div className="relative h-3 overflow-hidden rounded-full bg-white/60 dark:bg-slate-800/60">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out",
                    isHighCompletion
                      ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                      : isMediumCompletion
                        ? "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500"
                        : "bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500"
                  )}
                  style={{
                    width: isVisible ? `${completion.percentage}%` : "0%",
                    transitionDelay: "200ms",
                  }}
                />
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={cn(
                      "h-3.5 w-3.5",
                      isHighCompletion
                        ? "text-emerald-500"
                        : isMediumCompletion
                          ? "text-amber-500"
                          : "text-indigo-500"
                    )}
                  />
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {completion.missingFields.length} fields remaining
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-400 transition-all duration-300 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                  Complete profile
                  <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
