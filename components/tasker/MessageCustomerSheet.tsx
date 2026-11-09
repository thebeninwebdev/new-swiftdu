'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  MessageCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  DollarSign,
  Info,
  Truck,
  AlertTriangle,
  HelpCircle,
  MessageSquareQuote,
  Loader2,
  Check,
  Settings2,
  Smartphone,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { WhatsAppAppSelectorModal } from '@/components/tasker/WhatsAppAppSelectorModal'
import {
  openWhatsAppChat,
  resolveWhatsAppUrl,
  type WhatsAppAppPreference,
} from '@/lib/whatsapp/links'
import type { MessageCategory } from '@/models/message-template'

interface TemplateItem {
  id: string
  title: string
  description: string
  category: MessageCategory
  body: string
  renderedMessage: string
  displayOrder: number
  requiresPaymentVerification?: boolean
  paymentType?: string
}

interface MessagingContextResponse {
  order: {
    id: string
    orderNumber: string
    taskType: string
    isCafeInquiry: boolean
    orderStatus: string
    cafeInquiryStatus?: string
    hasPaid: boolean
    cafeInquiryFeePaid?: boolean
    deliveryLocation: string
    storeName: string
    amounts: {
      serviceFee: number | null
      itemTotal: number | null
      outstandingAmount: number | null
    }
  }
  customer: {
    name: string
    phone: string
  }
  tasker: {
    name: string
    preference: WhatsAppAppPreference
  }
  templates: TemplateItem[]
}

interface MessageCustomerSheetProps {
  orderId: string
  isOpen: boolean
  onClose: () => void
  initialPhone?: string
  initialCustomerName?: string
}

const CATEGORY_ICONS: Record<MessageCategory, any> = {
  intro: Sparkles,
  payment: DollarSign,
  update: Info,
  delivery: Truck,
  unavailable: AlertTriangle,
  clarification: HelpCircle,
  general: MessageSquareQuote,
}

const CATEGORY_COLORS: Record<
  MessageCategory,
  { bg: string; text: string; border: string }
> = {
  intro: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-900',
  },
  payment: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900',
  },
  update: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-900',
  },
  delivery: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900',
  },
  unavailable: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900',
  },
  clarification: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-900',
  },
  general: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
}

export function MessageCustomerSheet({
  orderId,
  isOpen,
  onClose,
  initialPhone = '',
  initialCustomerName = 'Customer',
}: MessageCustomerSheetProps) {
  const [data, setData] = useState<MessagingContextResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [taskerPreference, setTaskerPreference] = useState<WhatsAppAppPreference>('ask_every_time')
  const [showAppChooser, setShowAppChooser] = useState(false)

  const carouselRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const isScrollingFromCodeRef = useRef(false)
  const shouldReduceMotion = useReducedMotion()

  // Fetch messaging context when sheet opens
  useEffect(() => {
    if (!isOpen || !orderId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetchContext() {
      try {
        const res = await fetch(`/api/orders/${orderId}/messaging-context`, {
          cache: 'no-store',
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to load official message templates')
        }

        const json = (await res.json()) as MessagingContextResponse
        if (cancelled) return

        setData(json)
        setTaskerPreference(json.tasker?.preference || 'ask_every_time')
        setSelectedIndex(0)
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Error loading message templates')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchContext()

    return () => {
      cancelled = true
    }
  }, [isOpen, orderId])

  const templates = data?.templates || []
  const customerPhone = data?.customer?.phone || initialPhone
  const customerName = data?.customer?.name || initialCustomerName

  // Scroll carousel when selectedIndex changes programmatically
  const scrollToCard = useCallback((index: number) => {
    if (!carouselRef.current || index < 0 || index >= templates.length) return
    const cardEl = cardRefs.current[index]
    if (cardEl) {
      isScrollingFromCodeRef.current = true
      cardEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
      setTimeout(() => {
        isScrollingFromCodeRef.current = false
      }, 350)
    }
  }, [templates.length])

  const handleSelectIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < templates.length) {
        setSelectedIndex(index)
        scrollToCard(index)
      }
    },
    [scrollToCard, templates.length]
  )

  // Carousel scroll listener to detect swipe and update selected card
  const handleScroll = useCallback(() => {
    if (isScrollingFromCodeRef.current || !carouselRef.current) return
    const container = carouselRef.current
    const containerCenter = container.scrollLeft + container.clientWidth / 2

    let closestIndex = 0
    let minDistance = Number.MAX_VALUE

    cardRefs.current.forEach((cardEl, idx) => {
      if (!cardEl) return
      const cardCenter = cardEl.offsetLeft + cardEl.offsetWidth / 2
      const distance = Math.abs(containerCenter - cardCenter)
      if (distance < minDistance) {
        minDistance = distance
        closestIndex = idx
      }
    })

    if (closestIndex !== selectedIndex) {
      setSelectedIndex(closestIndex)
    }
  }, [selectedIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleSelectIndex(Math.min(templates.length - 1, selectedIndex + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleSelectIndex(Math.max(0, selectedIndex - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleSelectIndex, onClose, selectedIndex, templates.length])

  // Trigger opening WhatsApp
  const handleOpenWhatsApp = () => {
    if (!customerPhone) {
      toast.error('Customer phone number is unavailable for WhatsApp.')
      return
    }

    if (templates.length === 0) {
      toast.error('No message template selected.')
      return
    }

    const currentTemplate = templates[selectedIndex]
    if (!currentTemplate) return

    // If preference is ask_every_time, prompt user to select app
    if (taskerPreference === 'ask_every_time') {
      setShowAppChooser(true)
      return
    }

    // Launch with user's preferred app
    openWhatsAppChat({
      phone: customerPhone,
      text: currentTemplate.renderedMessage,
      preference: taskerPreference,
    })
  }

  // App selected from modal
  const handleAppSelected = async (
    targetApp: 'whatsapp' | 'whatsapp_business' | 'web',
    remember: boolean
  ) => {
    const currentTemplate = templates[selectedIndex]
    if (!currentTemplate || !customerPhone) return

    // If tasker chose to remember, persist via API
    if (remember) {
      const nextPref: WhatsAppAppPreference =
        targetApp === 'whatsapp'
          ? 'whatsapp'
          : targetApp === 'whatsapp_business'
          ? 'whatsapp_business'
          : 'ask_every_time'

      setTaskerPreference(nextPref)
      try {
        await fetch('/api/taskers/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsappAppPreference: nextPref }),
        })
      } catch {
        // Non-blocking preference save
      }
    }

    // Launch WhatsApp
    openWhatsAppChat(
      {
        phone: customerPhone,
        text: currentTemplate.renderedMessage,
      },
      targetApp
    )
  }

  const selectedTemplate = templates[selectedIndex]

  const preferenceLabel = useMemo(() => {
    if (taskerPreference === 'whatsapp') return 'WhatsApp'
    if (taskerPreference === 'whatsapp_business') return 'WhatsApp Business'
    return 'Ask Every Time'
  }, [taskerPreference])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Bottom Sheet */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Message Customer"
              initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
              animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.2 }
                  : { type: 'spring', damping: 28, stiffness: 320 }
              }
              drag={shouldReduceMotion ? false : 'y'}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 400) {
                  onClose()
                }
              }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[2.25rem] bg-white pb-safe shadow-2xl dark:bg-slate-900 sm:rounded-[2.25rem] sm:max-h-[88vh]"
            >
              {/* Drag Handle */}
              <div className="flex w-full justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-2 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Message Customer
                    </h2>
                    {data?.order?.orderNumber && (
                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        #{data.order.orderNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    To {customerName} · Choose an official SwiftDU message
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* WhatsApp App Preference Pill */}
                  <button
                    type="button"
                    onClick={() => setShowAppChooser(true)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                    title="Change WhatsApp application preference"
                  >
                    <Smartphone className="h-3 w-3 text-emerald-600" />
                    <span>{preferenceLabel}</span>
                    <Settings2 className="h-3 w-3 text-slate-400 ml-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close message sheet"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sheet Body Content */}
              <div className="flex-1 overflow-y-auto px-5 py-2">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                    <p className="mt-3 text-sm font-medium">Preparing official templates...</p>
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
                    <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
                    <p className="mt-2 text-sm font-bold text-rose-900 dark:text-rose-200">
                      {error}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      You must be assigned to this order to contact the customer.
                    </p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                    <MessageSquareQuote className="mx-auto h-10 w-10 text-slate-400" />
                    <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                      No active templates available
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      No messages match the current status for this order.
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Carousel Container */}
                    <div
                      ref={carouselRef}
                      onScroll={handleScroll}
                      className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-1 py-3 scroll-smooth"
                      style={{ scrollSnapType: 'x mandatory' }}
                    >
                      {templates.map((tmpl, idx) => {
                        const isSelected = idx === selectedIndex
                        const CategoryIcon =
                          CATEGORY_ICONS[tmpl.category] || CATEGORY_ICONS.general
                        const colors =
                          CATEGORY_COLORS[tmpl.category] || CATEGORY_COLORS.general

                        return (
                          <div
                            key={tmpl.id}
                            ref={(el) => {
                              cardRefs.current[idx] = el
                            }}
                            onClick={() => handleSelectIndex(idx)}
                            className={`w-[85vw] max-w-[360px] shrink-0 cursor-pointer snap-center rounded-3xl border-2 p-4 sm:p-5 transition-all duration-200 ${
                              isSelected
                                ? 'border-violet-600 bg-white shadow-xl shadow-violet-500/10 dark:border-violet-500 dark:bg-slate-800 ring-2 ring-violet-500/20'
                                : 'border-slate-200/80 bg-slate-50/70 opacity-70 hover:opacity-90 dark:border-slate-800 dark:bg-slate-900/60'
                            }`}
                          >
                            {/* Card Header: Category + Selected Pill */}
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}
                              >
                                <CategoryIcon className="h-3 w-3" />
                                <span className="capitalize">{tmpl.category}</span>
                              </span>

                              {isSelected ? (
                                <span className="flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                  Selected
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Tap to select
                                </span>
                              )}
                            </div>

                            {/* Title & Description */}
                            <h3 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">
                              {tmpl.title}
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {tmpl.description}
                            </p>

                            {/* Message Preview Bubble */}
                            <div className="mt-3.5 rounded-2xl bg-[#efeae2]/60 dark:bg-slate-950/80 p-3.5 border border-slate-200/50 dark:border-slate-800/80">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Message Preview
                              </p>
                              {/* Constrained scrollable preview container */}
                              <div className="max-h-36 overflow-y-auto overscroll-contain pr-1 text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-normal whitespace-pre-line">
                                {tmpl.renderedMessage}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Compact Bottom Navigation */}
                    <div className="mt-3 flex items-center justify-between px-2">
                      <button
                        type="button"
                        aria-label="Previous template"
                        disabled={selectedIndex === 0}
                        onClick={() => handleSelectIndex(selectedIndex - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* Pagination Indicator Dots & Badge */}
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Template {selectedIndex + 1} of {templates.length}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {templates.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              type="button"
                              aria-label={`Jump to template ${dotIdx + 1}`}
                              onClick={() => handleSelectIndex(dotIdx)}
                              className={`rounded-full transition-all ${
                                dotIdx === selectedIndex
                                  ? 'h-2 w-5 bg-violet-600 dark:bg-violet-400'
                                  : 'h-2 w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label="Next template"
                        disabled={selectedIndex === templates.length - 1}
                        onClick={() => handleSelectIndex(selectedIndex + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Action Footer */}
              <div className="border-t border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:rounded-b-[2.25rem]">
                <Button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  disabled={loading || Boolean(error) || templates.length === 0}
                  className="flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <MessageCircle className="h-5 w-5 fill-current" />
                  <span>Open WhatsApp</span>
                </Button>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Swiping changes the template. Tap Open WhatsApp when ready to send.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp App Selector Modal */}
      <WhatsAppAppSelectorModal
        open={showAppChooser}
        onClose={() => setShowAppChooser(false)}
        currentPreference={taskerPreference}
        onSelectApp={handleAppSelected}
      />
    </>
  )
}
