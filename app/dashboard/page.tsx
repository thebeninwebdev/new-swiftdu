'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Droplets,
  FileText,
  Info,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Minus,
  Plus,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ProfileCompletionCard } from '@/components/profile-completion-card'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { authClient } from '@/lib/auth-client'
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  PHOTOCOPY_PRICE_PER_PAGE,
  PRINTING_PRICE_PER_PAGE,
  PRINTING_TASK_TYPE,
  RESTAURANT_MAX_PEOPLE,
  CAFE_INQUIRY_EXTRA_FEE,
  WATER_BAG_PRICE,
  WATER_BAG_FEE,
  WATER_TASK_TYPE,
  DRY_CLEANING_TASK_TYPE,
} from '@/lib/pricing'

const REALTIME_PAUSE_MS = 1200
const LOW_TASKER_NOTICE_RETURN_DATE = '2026-06-01'
const PACKAGING_LANGUAGE_STORAGE_KEY = 'swiftdu:restaurant-packaging-language'
const SERVICE_FEE_INCREASE_NOTICE =
  'From June 14, 2026, SwiftDU service fee will increase to N600 per task.'

type PackagingLanguage = 'pidgin' | 'english'

interface ErrandData {
  taskType: string
  description: string
  amount: string
  location: string
  store?: string
  waterBags?: string
  noteSize?: string
  numberOfPages?: string
  printingServiceType?: string
  printingNeedsEditing?: string
  deadline?: string
  packaging?: string
  cafeInquiry?: boolean
  restaurantItemPrice: string
  restaurantPeople: string
  restaurantTakeawayCount: string
}

interface ActiveOrder {
  _id: string
  taskType: string
  description: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  createdAt?: string
  hasPaid?: boolean
  completionTimerStartedAt?: string
  completionDueAt?: string
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  isDeclinedTask?: boolean
  declinedMessage?: string
  taskerId?: string | null
}

type ActiveOrderRealtimePayload = Partial<ActiveOrder> & {
  _id?: string
}

interface TaskTypeConfig {
  value: string
  label: string
  description: string
  mobileDescription: string
  icon: LucideIcon
  accent: string
}

interface ExcoDashboardAccess {
  excoRole: string;
  label: string;
  dashboardPath: string;
}

const taskTypes: TaskTypeConfig[] = [
  {
    value: 'restaurant',
    label: 'Restaurant Food',
    description: 'Meals and food pickups from campus restaurants.',
    mobileDescription: 'Food & meals',
    icon: ShoppingBag,
    accent: 'from-blue-500 to-cyan-500',
  },
  {
    value: 'printing',
    label: 'Printing Services',
    description: 'Notes, assignments, and document printing.',
    mobileDescription: 'Documents',
    icon: FileText,
    accent: 'from-sky-500 to-indigo-500',
  },
  {
    value: 'copy_notes',
    label: 'Copy Notes',
    description: 'Copy small or big notes by page count.',
    mobileDescription: 'By page',
    icon: FileText,
    accent: 'from-amber-500 to-yellow-500',
  },
  {
    value: 'shopping',
    label: 'Store Shopping',
    description: 'Groceries, toiletries, and small campus-store items.',
    mobileDescription: 'Groceries',
    icon: Store,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    value: DRY_CLEANING_TASK_TYPE,
    label: 'Dry Cleaning',
    description: 'Laundry pickup, washing, ironing, and delivery.',
    mobileDescription: 'Laundry',
    icon: Shirt,
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    value: WATER_TASK_TYPE,
    label: 'Bag of Water',
    description: 'Order bags of water at a fixed per-bag price.',
    mobileDescription: 'Per bag',
    icon: Droplets,
    accent: 'from-cyan-500 to-blue-500',
  },
]

const storeOptions: Record<string, Array<{ value: string; label: string }>> = {
  printing: [
    { value: '', label: 'Select a store...' },
    { value: 'teddy', label: 'Teddy Store' },
    { value: 'faith', label: 'Faith Store' },
  ],
  shopping: [
    { value: '', label: 'Select a store...' },
    { value: 'rita', label: 'Rita Store' },
    { value: 'sarah', label: 'Sarah Store' },
    { value: 'muuy V', label: 'Mummy V' },
  ],
  restaurant: [
    { value: '', label: 'Select a store...' },
    { value: 'tasker_choose', label: 'Help me choose / any open cafe' },
    { value: 'akpan', label: 'Akpan Store' },
    { value: 'mama', label: "Mama's Kitchen" },
    { value: 'golley', label: 'Golley Shop' },
    { value: 'indomie', label: 'Indomie Spot' },
  ],
}

const restaurantQuickOrders = [
  'Fried rice and chicken',
  'Jollof rice and chicken',
  'Indomie and egg',
  'White rice and stew',
  'Beans and plantain',
  'Rice, chicken and drink',
]

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/[₦,\s]/g, '')
  if (!normalized) return 0
  return Number(normalized)
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-NG')
}

function getDateTimeInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function formatReadyDate(value?: string) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getLagosDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return year && month && day ? `${year}-${month}-${day}` : ''
}

function isLowTaskerAvailabilityWindow(date: Date) {
  if (getLagosDateKey(date) < LOW_TASKER_NOTICE_RETURN_DATE) return false

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)

  return ['Mon', 'Wed'].includes(weekday || '') && hour >= 0 && hour < 14
}


function TypeTypingEffect({
  text,
  speed = 30,
  className = '',
  onComplete,
}: {
  text: string
  speed?: number
  className?: string
  onComplete?: () => void
}) {
  const [displayed, setDisplayed] = useState('')
  const [isDone, setIsDone] = useState(false)
  const indexRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayed('')
    setIsDone(false)
    indexRef.current = 0
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    const typeNext = () => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1))
        indexRef.current += 1
        timeoutRef.current = window.setTimeout(typeNext, speed)
      } else {
        setIsDone(true)
        onComplete?.()
      }
    }

    timeoutRef.current = window.setTimeout(typeNext, speed)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [text, speed, onComplete])

  return (
    <span className={className}>
      {displayed}
      {!isDone && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
      )}
    </span>
  )
}

export default function ErrandWizardPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRealtimePaused, setIsRealtimePaused] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [packagingLanguage, setPackagingLanguage] = useState<PackagingLanguage>('pidgin')
  const [isTaskerAvailabilityNoticeDismissed, setIsTaskerAvailabilityNoticeDismissed] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isExtendingActiveOrderTimer, setIsExtendingActiveOrderTimer] = useState(false)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [excoDashboard, setExcoDashboard] = useState<ExcoDashboardAccess | null>(null)
  const [serviceFeeDiscount, setServiceFeeDiscount] = useState<{
    hasAvailableDiscount: boolean
    hasActiveReservation: boolean
    remainingOrders: number
  } | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const activeOrderRef = useRef<ActiveOrder | null>(null)
  const fetchingActiveOrderRef = useRef(false)
  const isRealtimePausedRef = useRef(false)
  const realtimeResumeTimeoutRef = useRef<number | null>(null)
  const isTasker = session?.user.role === 'tasker'

  const [formData, setFormData] = useState<ErrandData>({
    taskType: 'restaurant',
    description: '',
    amount: '',
    location: '',
    store: '',
    waterBags: '',
    noteSize: '',
    numberOfPages: '',
    printingServiceType: '',
    printingNeedsEditing: '',
    deadline: '',
    packaging: '',
    cafeInquiry: false,
    restaurantItemPrice: '',
    restaurantPeople: '1',
    restaurantTakeawayCount: '',
  })
  const sessionUserId = session?.user?.id

  useEffect(() => {
    activeOrderRef.current = activeOrder
  }, [activeOrder])

  useEffect(() => {
    if (!sessionUserId) {
      setServiceFeeDiscount(null)
      return
    }

    let ignore = false

    async function loadServiceFeeDiscount() {
      try {
        const response = await fetch('/api/users/me/service-fee-discount', {
          cache: 'no-store',
        })
        const payload = await response.json()

        if (!ignore) {
          setServiceFeeDiscount(response.ok ? payload : null)
        }
      } catch {
        if (!ignore) {
          setServiceFeeDiscount(null)
        }
      }
    }

    void loadServiceFeeDiscount()

    return () => {
      ignore = true
    }
  }, [sessionUserId, activeOrder?._id, activeOrder?.status])

  const fetchCurrentOrder = useCallback(async () => {
    if (fetchingActiveOrderRef.current) return
    fetchingActiveOrderRef.current = true

    try {
      const response = await fetch('/api/orders?current=true')
      if (!response.ok) throw new Error('Failed to fetch current order')
      const data = await response.json()
      activeOrderRef.current = data
      setActiveOrder(data)
    } catch {
      activeOrderRef.current = null
      setActiveOrder(null)
    } finally {
      fetchingActiveOrderRef.current = false
    }
  }, [])

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  const applyActiveOrderRealtimeUpdate = useCallback((payload?: ActiveOrderRealtimePayload) => {
    if (!payload?._id || activeOrderRef.current?._id !== payload._id) {
      return false
    }

    const nextOrder = {
      ...activeOrderRef.current,
      ...payload,
      _id: activeOrderRef.current._id,
    } as ActiveOrder

    activeOrderRef.current = nextOrder
    setActiveOrder(nextOrder)
    return true
  }, [])

  const setRealtimePauseState = useCallback((paused: boolean) => {
    isRealtimePausedRef.current = paused
    setIsRealtimePaused(paused)
  }, [])

  const pauseRealtime = useCallback(
    (duration = REALTIME_PAUSE_MS) => {
      disconnectSocket()
      setRealtimePauseState(true)

      if (realtimeResumeTimeoutRef.current) {
        window.clearTimeout(realtimeResumeTimeoutRef.current)
      }

      realtimeResumeTimeoutRef.current = window.setTimeout(() => {
        setRealtimePauseState(false)
        realtimeResumeTimeoutRef.current = null
      }, duration)
    },
    [disconnectSocket, setRealtimePauseState]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const updateMobileViewport = () => setIsMobileViewport(mediaQuery.matches)

    updateMobileViewport()
    mediaQuery.addEventListener('change', updateMobileViewport)

    return () => {
      mediaQuery.removeEventListener('change', updateMobileViewport)
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return

    try {
      const savedLanguage = window.localStorage.getItem(PACKAGING_LANGUAGE_STORAGE_KEY)
      if (savedLanguage === 'english' || savedLanguage === 'pidgin') {
        setPackagingLanguage(savedLanguage)
      }
    } catch {
      setPackagingLanguage('pidgin')
    }
  }, [mounted])

  const updatePackagingLanguage = useCallback((language: PackagingLanguage) => {
    setPackagingLanguage(language)

    try {
      window.localStorage.setItem(PACKAGING_LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Preference persistence is best-effort; the UI should still switch immediately.
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const interval = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    void fetchCurrentOrder()
  }, [fetchCurrentOrder, mounted])

  useEffect(() => {
    if (!mounted || !sessionUserId) return

    async function fetchExcoDashboard() {
      try {
        const response = await fetch('/api/exco/me', { cache: 'no-store' })
        if (!response.ok) return

        const data = (await response.json()) as Partial<ExcoDashboardAccess>
        if (data.excoRole && data.label && data.dashboardPath) {
          setExcoDashboard({
            excoRole: data.excoRole,
            label: data.label,
            dashboardPath: data.dashboardPath,
          })
        } else {
          setExcoDashboard(null)
        }
      } catch {
        setExcoDashboard(null)
      }
    }

    void fetchExcoDashboard()
  }, [mounted, sessionUserId])

  useEffect(() => {
    if (!mounted) return

    const onFocus = () => {
      if (!isRealtimePausedRef.current && document.visibilityState === 'visible') {
        void fetchCurrentOrder()
      }
    }

    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchCurrentOrder, mounted])

  useEffect(() => {
    if (!mounted || isRealtimePaused || !activeOrder?._id) {
      disconnectSocket()
      return
    }

    const activeOrderId = activeOrder._id
    const socket = io({ withCredentials: true, transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('order:watch', activeOrderId)
    })

    socket.on('order:updated', (payload?: ActiveOrderRealtimePayload) => {
      const applied = applyActiveOrderRealtimeUpdate(payload)
      if (!applied && (!payload?._id || payload._id === activeOrderId)) {
        void fetchCurrentOrder()
      }
    })

    return () => {
      if (socket.connected) {
        socket.emit('order:unwatch', activeOrderId)
      }
      if (socketRef.current === socket) {
        socket.disconnect()
        socketRef.current = null
        return
      }
      socket.disconnect()
    }
  }, [
    activeOrder?._id,
    applyActiveOrderRealtimeUpdate,
    disconnectSocket,
    fetchCurrentOrder,
    isRealtimePaused,
    mounted,
  ])

  useEffect(() => {
    const handleWizardBack = () => {
      setStep((previous) => Math.max(1, previous - 1))
      setErrors({})
    }

    window.addEventListener('swiftdu-wizard-back', handleWizardBack)

    return () => {
      window.removeEventListener('swiftdu-wizard-back', handleWizardBack)
      window.dispatchEvent(
        new CustomEvent('swiftdu-wizard-back-state', {
          detail: { canGoBack: false },
        })
      )
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    window.dispatchEvent(
      new CustomEvent('swiftdu-wizard-back-state', {
        detail: { canGoBack: step > 1 },
      })
    )
  }, [mounted, step])

  useEffect(() => {
    return () => {
      if (realtimeResumeTimeoutRef.current) {
        window.clearTimeout(realtimeResumeTimeoutRef.current)
      }
      disconnectSocket()
    }
  }, [disconnectSocket])

  const restaurantFoodBudget = parseMoneyInput(formData.restaurantItemPrice)
  const isCafeInquiry = formData.taskType === 'restaurant' && formData.cafeInquiry === true
  const restaurantPeopleCount = Number(formData.restaurantPeople || 1)
  const normalizedRestaurantPeopleCount =
    Number.isInteger(restaurantPeopleCount) && restaurantPeopleCount > 0
      ? restaurantPeopleCount
      : 1
  const restaurantTakeawayCount = Number(formData.restaurantTakeawayCount || 0)
  const normalizedRestaurantTakeawayCount =
    Number.isInteger(restaurantTakeawayCount) && restaurantTakeawayCount >= 0
      ? Math.min(restaurantTakeawayCount, normalizedRestaurantPeopleCount)
      : 0
  const restaurantBudget = restaurantFoodBudget
  const restaurantDescription = isCafeInquiry
    ? formData.description.trim() || 'Text me what is in cafe'
    : formData.description.trim()
  const shoppingBudget = parseMoneyInput(formData.amount)
  const shoppingDescription = formData.description.trim()
  const dryCleaningDescription = formData.description.trim()
  const waterBags = Number(formData.waterBags || 0)
  const numberOfPages = Number(formData.numberOfPages || 0)
  const printingLabel =
    formData.printingServiceType === 'photocopying' ? 'Photocopying' : 'Printing'
  const effectiveDescription =
    formData.taskType === 'restaurant'
      ? restaurantDescription
      : formData.taskType === 'shopping' || formData.taskType === DRY_CLEANING_TASK_TYPE
        ? shoppingDescription
        : formData.taskType === PRINTING_TASK_TYPE
          ? [
              `${printingLabel} job`,
              `${numberOfPages || 0} page${numberOfPages === 1 ? '' : 's'}`,
              `Editing needed: ${formData.printingNeedsEditing === 'yes' ? 'Yes' : 'No'}`,
              formData.description.trim(),
            ]
              .filter(Boolean)
              .join(' - ')
        : formData.description.trim()
  const amount =
    formData.taskType === 'restaurant'
      ? restaurantBudget
      : formData.taskType === 'shopping' || formData.taskType === DRY_CLEANING_TASK_TYPE
        ? shoppingBudget
        : formData.taskType === PRINTING_TASK_TYPE
          ? 0
        : parseMoneyInput(formData.amount || '')
  const description = effectiveDescription
  const taskType = formData.taskType || 'restaurant'
  const pricing = calculateOrderPricing({
    amount: Number.isFinite(amount) ? amount : 0,
    taskType,
    store: formData.store,
    restaurantPeopleCount: normalizedRestaurantPeopleCount,
    restaurantTakeawayCount: normalizedRestaurantTakeawayCount,
    waterBags: Number.isFinite(waterBags) ? waterBags : 0,
    noteSize: formData.noteSize,
    numberOfPages: Number.isFinite(numberOfPages) ? numberOfPages : 0,
    printingServiceType: formData.printingServiceType,
    printingNeedsEditing: formData.printingNeedsEditing === 'yes',
    cafeInquiry: isCafeInquiry,
  })
  const hasAvailableServiceFeeDiscount = Boolean(
    serviceFeeDiscount?.hasAvailableDiscount && pricing.serviceFee > 0
  )
  const discountRemainingOrders = Math.max(
    0,
    Number(serviceFeeDiscount?.remainingOrders || 0)
  )
  const hasAvailableAccountDiscount = Boolean(
    serviceFeeDiscount?.hasAvailableDiscount && discountRemainingOrders > 0
  )
  const discountOrderLabel = `${discountRemainingOrders} order${
    discountRemainingOrders === 1 ? '' : 's'
  }`
  const discountOrderPhrase =
    discountRemainingOrders === 1
      ? 'your next order'
      : `your next ${discountRemainingOrders} orders`
  const displayedServiceFee = hasAvailableServiceFeeDiscount ? 0 : pricing.serviceFee
  const displayedTotalAmount = hasAvailableServiceFeeDiscount
    ? Math.max(0, pricing.totalAmount - pricing.serviceFee)
    : pricing.totalAmount
  const restaurantPackagingNote =
    normalizedRestaurantTakeawayCount > 0
      ? normalizedRestaurantTakeawayCount === normalizedRestaurantPeopleCount
        ? 'Takeaway pack'
        : `${normalizedRestaurantTakeawayCount} takeaway, ${
            normalizedRestaurantPeopleCount - normalizedRestaurantTakeawayCount
          } cellophane`
      : 'Cellophane'
  const shouldShowTieredServiceFee =
    pricing.pricingModel === 'tiered' &&
    ((formData.taskType === PRINTING_TASK_TYPE && pricing.amount > 0) ||
      (Number.isFinite(amount) && amount > 0))
  const selectedStores = storeOptions[formData.taskType] || []
  const selectedStoreLabel = selectedStores.find((item) => item.value === formData.store)?.label || ''
  const waterWarning =
    description.length > 0 &&
    descriptionMentionsWater(description) &&
    formData.taskType !== WATER_TASK_TYPE
  const packagingStep = -1
  const deliveryStep = 3
  const reviewStep = 4
  const stepTitles = ['Choose Task', 'Details', 'Delivery', 'Review']
  const stepIcons = [ShoppingBag, FileText, MapPin, CreditCard]
  const packagingCopy =
    packagingLanguage === 'english'
      ? {
          subtitle: 'A quick packaging check before delivery details.',
          languageButton: 'Use Nigerian Pidgin',
          singleQuestion: 'Should this order be in takeaway or cellophane?',
          multipleQuestion: `You are ordering for ${normalizedRestaurantPeopleCount} people. Is everything in takeaway, or should some be cellophane?`,
          singleTakeaway: 'Takeaway',
          allTakeaway: 'Yes, all takeaway',
          singleCellophane: 'Cellophane',
          mixedPrompt: 'No, ask me',
          takeawayCountQuestion: `How many of the ${normalizedRestaurantPeopleCount} orders should be in takeaway?`,
          packagingLabel: 'Packaging note',
        }
      : {
          subtitle: 'Make we quickly confirm packaging before delivery details.',
          languageButton: 'Show in English',
          singleQuestion: 'You want make dem put this food for takeaway pack or cellophane?',
          multipleQuestion: `You dey order for ${normalizedRestaurantPeopleCount} people. Make all enter takeaway pack, abi some go dey cellophane?`,
          singleTakeaway: 'Takeaway',
          allTakeaway: 'Yes, all takeaway',
          singleCellophane: 'Cellophane',
          mixedPrompt: 'No, ask me',
          takeawayCountQuestion: `How many from the ${normalizedRestaurantPeopleCount} orders make enter takeaway pack?`,
          packagingLabel: 'Packaging note',
        }

  const clearError = useCallback((field: string) =>
    setErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    }), [])

  const handleSpeechTranscript = useCallback(
    (value: string) => {
      pauseRealtime()
      setFormData((previous) => ({ ...previous, description: value }))
      clearError('description')
    },
    [clearError, pauseRealtime]
  )

  const handleSpeechError = useCallback((error: string) => {
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      toast.error('Microphone permission denied')
      return
    }

    if (error === 'audio-capture') {
      toast.error('Microphone unavailable')
      return
    }

    if (error !== 'aborted' && error !== 'no-speech') {
      toast.error('Speech input stopped. Please try again.')
    }
  }, [])

  const {
    isListening: isSpeechListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onTranscript: handleSpeechTranscript,
    onStart: () => toast.info('Listening...'),
    onCaptured: () => toast.success('Speech captured'),
    onError: handleSpeechError,
  })

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    pauseRealtime()
    const { name, value } = event.target
    const nextValue =
      name === 'restaurantItemPrice' || name === 'amount'
        ? formatMoneyInput(value)
        : value
    setFormData((previous) => ({ ...previous, [name]: nextValue }))
    clearError(name)
    if (
      name === 'restaurantItemPrice' ||
      name === 'restaurantPeople'
    ) {
      clearError('amount')
    }
  }

  const selectTaskType = (value: string) => {
    pauseRealtime()
    setFormData((previous) => ({
      ...previous,
      taskType: value,
      store: value === 'restaurant' ? 'tasker_choose' : '',
      description: '',
      location: '',
      waterBags: '',
      noteSize: '',
      numberOfPages: '',
      printingServiceType: '',
      printingNeedsEditing: '',
      deadline: '',
      packaging: '',
      cafeInquiry: false,
      restaurantItemPrice: '',
      restaurantPeople: '1',
      restaurantTakeawayCount: '',
      amount:
        value === 'copy_notes' ||
        value === WATER_TASK_TYPE ||
        value === PRINTING_TASK_TYPE
          ? '0'
          : '',
    }))
    ;[
      'taskType',
      'store',
      'waterBags',
      'noteSize',
      'numberOfPages',
      'printingServiceType',
      'printingNeedsEditing',
      'deadline',
      'description',
      'amount',
      'location',
      'restaurantItemPrice',
      'restaurantPeople',
      'restaurantTakeawayCount',
    ].forEach(clearError)
    setStep(2)
    setErrors({})
  }

  const handleLocationSelect = (value: string) => {
    pauseRealtime()
    setFormData((previous) => ({ ...previous, location: value }))
    clearError('location')
  }

  const handleEditStep = (nextStep: number) => {
    pauseRealtime()
    setStep(nextStep)
  }

  const validateStep = (stepNumber: number) => {
    const nextErrors: Record<string, string> = {}

    if (stepNumber === 1 && !formData.taskType) nextErrors.taskType = 'Select a task type to continue.'

if (stepNumber === 2) {
  if (
    formData.taskType &&
    formData.taskType !== 'others' &&
    formData.taskType !== 'copy_notes' &&
    formData.taskType !== DRY_CLEANING_TASK_TYPE &&
    formData.taskType !== WATER_TASK_TYPE &&
    !formData.store
  ) {
    nextErrors.store = 'Select the store for this task.'
  }

  if (formData.taskType === 'restaurant') {
    if (!isCafeInquiry && !restaurantDescription) {
      nextErrors.description = 'Describe what you want to order.'
    } else if (!isCafeInquiry && restaurantDescription.length < 5) {
      nextErrors.description = 'Use at least 5 characters.'
    }

    if (!isMobileViewport && !isCafeInquiry && (!Number.isFinite(restaurantFoodBudget) || restaurantFoodBudget <= 0)) {
      nextErrors.restaurantItemPrice = 'Enter a valid food budget.'
    }
  }

  if (
    formData.taskType === 'restaurant' &&
    (!Number.isInteger(restaurantPeopleCount) ||
      restaurantPeopleCount < 1 ||
      restaurantPeopleCount > RESTAURANT_MAX_PEOPLE)
  ) {
    nextErrors.restaurantPeople = `Enter 1 to ${RESTAURANT_MAX_PEOPLE} people for this food order.`
  }

  if (formData.taskType === 'shopping') {
    if (!shoppingDescription) {
      nextErrors.description = 'Describe the items you want.'
    } else if (shoppingDescription.length < 5) {
      nextErrors.description = 'Use at least 5 characters.'
    }

    if (!Number.isFinite(shoppingBudget) || shoppingBudget <= 0) {
      nextErrors.amount = 'Enter a valid shopping budget.'
    }
  }

  if (formData.taskType === DRY_CLEANING_TASK_TYPE) {
    if (!dryCleaningDescription) {
      nextErrors.description = 'Describe the clothes you want cleaned.'
    } else if (dryCleaningDescription.length < 5) {
      nextErrors.description = 'Use at least 5 characters.'
    }

    if (!Number.isFinite(shoppingBudget) || shoppingBudget <= 0) {
      nextErrors.amount = 'Enter a valid dry cleaning budget.'
    }
  }

  if (formData.taskType === 'restaurant' && waterWarning) {
    nextErrors.description = 'Choose the bag of water task for water delivery.'
  }

  if (
    formData.taskType === WATER_TASK_TYPE &&
    (!Number.isInteger(waterBags) || waterBags <= 0)
  ) {
    nextErrors.waterBags = 'Enter the number of water bags.'
  }

  if (formData.taskType === 'copy_notes') {
    const readyDate = formData.deadline ? new Date(formData.deadline) : null

    if (formData.noteSize !== 'big' && formData.noteSize !== 'small') {
      nextErrors.noteSize = 'Choose the note size.'
    }

    if (!Number.isInteger(numberOfPages) || numberOfPages < 1) {
      nextErrors.numberOfPages = 'Enter the number of pages.'
    }

    if (!readyDate || Number.isNaN(readyDate.getTime()) || readyDate.getTime() <= Date.now()) {
      nextErrors.deadline = 'Choose a future deadline.'
    }
  }

  if (formData.taskType === PRINTING_TASK_TYPE) {
    if (
      formData.printingServiceType !== 'printing' &&
      formData.printingServiceType !== 'photocopying'
    ) {
      nextErrors.printingServiceType = 'Choose printing or photocopying.'
    }

    if (!Number.isInteger(numberOfPages) || numberOfPages < 1) {
      nextErrors.numberOfPages = 'Enter the number of pages.'
    }

    if (formData.printingNeedsEditing !== 'yes' && formData.printingNeedsEditing !== 'no') {
      nextErrors.printingNeedsEditing = 'Choose whether editing is needed.'
    }
  }

  if (
    formData.taskType !== WATER_TASK_TYPE &&
    formData.taskType !== 'restaurant' &&
    formData.taskType !== 'shopping' &&
    formData.taskType !== DRY_CLEANING_TASK_TYPE &&
    formData.taskType !== PRINTING_TASK_TYPE
  ) {
    if (!description) {
      nextErrors.description = 'Description is required.'
    } else if (description.length < 10) {
      nextErrors.description = 'Use at least 10 characters.'
    } else if (waterWarning) {
      nextErrors.description =
        'Choose the bag of water task for water delivery.'
    }
  }

  if (
    formData.taskType !== 'copy_notes' &&
    formData.taskType !== PRINTING_TASK_TYPE &&
    formData.taskType !== 'restaurant' &&
    formData.taskType !== 'shopping' &&
    formData.taskType !== DRY_CLEANING_TASK_TYPE &&
    formData.taskType !== WATER_TASK_TYPE &&
    (formData.amount === '' || !Number.isFinite(amount) || amount < 0)
  ) {
    nextErrors.amount = 'Enter a valid item amount.'
  }
}

if (stepNumber === 2) {
  if (
    formData.taskType === 'restaurant' &&
    (formData.packaging === 'mixed' && formData.restaurantTakeawayCount === '')
  ) {
    nextErrors.restaurantTakeawayCount = 'Tell us how many should be takeaway.'
  } else if (
    formData.taskType === 'restaurant' &&
    (!Number.isInteger(restaurantTakeawayCount) ||
      restaurantTakeawayCount < 0 ||
      restaurantTakeawayCount > normalizedRestaurantPeopleCount)
  ) {
    nextErrors.restaurantTakeawayCount = 'Choose how many orders need takeaway packs.'
  }
}

 if (stepNumber === deliveryStep) {
  if (
    formData.taskType === 'restaurant' &&
    !isCafeInquiry &&
    (!Number.isFinite(restaurantFoodBudget) || restaurantFoodBudget <= 0)
  ) {
    nextErrors.restaurantItemPrice = 'Enter a valid food budget.'
  }

  if (!formData.location.trim()) {
    nextErrors.location = 'Enter the delivery location.'
  }
}

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    pauseRealtime()
    if (!validateStep(step)) return
    setStep((previous) => previous + 1)
    setErrors({})
  }

  const handleBack = () => {
    pauseRealtime()
    setStep((previous) => previous - 1)
    setErrors({})
  }

  const createOrder = async () => {
    pauseRealtime(REALTIME_PAUSE_MS * 2)

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          description: formData.taskType === WATER_TASK_TYPE ? '' : description,
          amount: String(amount),
          cafeInquiry: isCafeInquiry,
          restaurantPeopleCount:
            formData.taskType === 'restaurant'
              ? normalizedRestaurantPeopleCount
              : undefined,
          restaurantTakeawayCount:
            formData.taskType === 'restaurant'
              ? normalizedRestaurantTakeawayCount
              : undefined,
          printingServiceType: formData.printingServiceType,
          printingNeedsEditing: formData.printingNeedsEditing === 'yes',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to submit task.')
        return
      }

      const createdOrder = await response.json()
      toast.success('Task posted successfully. Taskers can see it now.')
      setActiveOrder(createdOrder)
      setFormData({
        taskType: 'restaurant',
        description: '',
        amount: '',
        location: '',
        store: '',
        waterBags: '',
        noteSize: '',
        numberOfPages: '',
        printingServiceType: '',
        printingNeedsEditing: '',
        deadline: '',
        packaging: '',
        cafeInquiry: false,
        restaurantItemPrice: '',
        restaurantPeople: '1',
        restaurantTakeawayCount: '',
      })
      setStep(2)
      router.push(`/dashboard/tasks/${createdOrder._id}`)
    } catch {
      toast.error('An error occurred while posting the task.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    pauseRealtime(REALTIME_PAUSE_MS * 2)

    if (!validateStep(2)) {
      setStep(2)
      return
    }
    if (!validateStep(deliveryStep)) {
      setStep(deliveryStep)
      return
    }
    await createOrder()
  }

  const handleExtendActiveOrderTimer = async () => {
    if (!activeOrder || isExtendingActiveOrderTimer) return

    pauseRealtime(REALTIME_PAUSE_MS * 2)
    setIsExtendingActiveOrderTimer(true)

    try {
      const response = await fetch(`/api/orders/${activeOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendCompletionTimer: true }),
      })
      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Failed to add more time.')
        return
      }

      activeOrderRef.current = payload
      setActiveOrder(payload)
      toast.success('Ten minutes added for your tasker.')
    } catch {
      toast.error('Failed to add more time.')
    } finally {
      setIsExtendingActiveOrderTimer(false)
    }
  }

  const activeStatusLabel = activeOrder
    ? activeOrder.status === 'pending'
      ? 'Searching for a tasker'
      : activeOrder.isDeclinedTask
        ? 'Payment under review'
        : activeOrder.hasPaid
          ? 'Transfer confirmed and task in progress'
          : 'Tasker assigned, payment required'
    : null
  const activeStatusDescription = activeOrder
    ? activeOrder.status === 'pending'
      ? 'We are actively notifying taskers for this errand right now. You can still post another task below.'
      : activeOrder.isDeclinedTask
        ? activeOrder.declinedMessage ||
          'The transfer is under review. You can still create another task while our team follows up.'
        : activeOrder.hasPaid
          ? 'Your payment has been confirmed and the task is moving. You can still book another errand below.'
          : 'This order is waiting for payment confirmation. You can open the tracker anytime and still post another task now.'
    : null
  const activeOrderCompletionStartedMs = activeOrder?.completionTimerStartedAt
    ? new Date(activeOrder.completionTimerStartedAt).getTime()
    : activeOrder?.createdAt
      ? new Date(activeOrder.createdAt).getTime()
      : NaN
  const activeOrderCompletionWindowMinutes =
    Number(activeOrder?.completionWindowMinutes || 0) > 0
      ? Number(activeOrder?.completionWindowMinutes || 0)
      : 20
  const activeOrderCompletionExtensionMinutes = Number(
    activeOrder?.completionExtensionMinutes || 0
  )
  const computedActiveOrderCompletionDueMs =
    Number.isFinite(activeOrderCompletionStartedMs)
      ? activeOrderCompletionStartedMs +
        (activeOrderCompletionWindowMinutes + activeOrderCompletionExtensionMinutes) * 60000
      : NaN
  const activeOrderCompletionDueMs = activeOrder?.completionDueAt
    ? new Date(activeOrder.completionDueAt).getTime()
    : computedActiveOrderCompletionDueMs
  const hasActiveOrderCompletionTimer =
    Boolean(activeOrder?.hasPaid) &&
    Number.isFinite(activeOrderCompletionDueMs) &&
    activeOrder?.status !== 'completed' &&
    activeOrder?.status !== 'cancelled'
  const activeOrderCompletionRemainingMs = hasActiveOrderCompletionTimer
    ? activeOrderCompletionDueMs - currentTime.getTime()
    : 0
  const activeOrderCompletionTimerExpired =
    hasActiveOrderCompletionTimer && activeOrderCompletionRemainingMs <= 0
  const activeOrderCompletionWindowMs =
    activeOrderCompletionWindowMinutes > 0
      ? activeOrderCompletionWindowMinutes * 60000
      : activeOrderCompletionDueMs - activeOrderCompletionStartedMs
  const activeOrderCompletionProgress =
    hasActiveOrderCompletionTimer && activeOrderCompletionWindowMs > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((currentTime.getTime() - activeOrderCompletionStartedMs) /
              activeOrderCompletionWindowMs) *
              100
          )
        )
      : 0
  const showLowTaskerAvailabilityNotice =
    isLowTaskerAvailabilityWindow(currentTime) && !isTaskerAvailabilityNoticeDismissed
  const shouldShowDiscountCard = hasAvailableAccountDiscount && step === 1
  const dismissTaskerAvailabilityNotice = useCallback(() => {
    setIsTaskerAvailabilityNoticeDismissed(true)
  }, [])
  const dismissNoticeOnWizardButtonClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!(event.target instanceof HTMLElement)) return
      if (event.target.closest('button')) {
        window.setTimeout(dismissTaskerAvailabilityNotice, 0)
      }
    },
    [dismissTaskerAvailabilityNotice]
  )

  const renderServiceFeeAmount = (className = 'font-medium') =>
    hasAvailableServiceFeeDiscount ? (
      <span className="flex items-center justify-end gap-2 text-right">
        <span className="text-slate-400 line-through dark:text-slate-500">
          {formatNaira(pricing.serviceFee)}
        </span>
        <span className="font-black text-emerald-600 dark:text-emerald-300">
          {formatNaira(0)}
        </span>
      </span>
    ) : (
      <span className={className}>{formatNaira(displayedServiceFee)}</span>
    )

  const renderServiceFeeIncreaseNotice = (className = '') => (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 ${className}`}
    >
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <p className="font-semibold">{SERVICE_FEE_INCREASE_NOTICE}</p>
      </div>
    </div>
  )

  const selectedTask = taskTypes.find((item) => item.value === formData.taskType) || taskTypes[0]
  const quickLocations = ['Amnesty Hostel', 'Girls Hostel', 'PLT', 'Library', 'NDDC Auditorium']

  const renderCategoryCards = (compact = false) => (
    <div className={compact ? 'space-y-2.5' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-6'}>
      {taskTypes.map((item) => {
        const Icon = item.icon
        const selected = formData.taskType === item.value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              selectTaskType(item.value)
              if (compact) {
                setStep(2)
              }
            }}
            className={`group flex ${compact ? 'w-full items-center gap-3 rounded-2xl px-3.5 py-5 text-left shadow-sm min-[390px]:py-5.5' : 'min-h-28 flex-col items-center justify-center rounded-xl p-4 text-center'} border transition ${
              selected
                ? compact
                  ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm dark:border-blue-500 dark:bg-blue-950/30 dark:text-blue-100'
                  : 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm dark:border-blue-500 dark:bg-blue-950/30 dark:text-blue-100'
                : compact
                  ? 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900'
            }`}
          >
            <span className={`flex ${compact ? 'h-10 w-10' : 'mb-3 h-12 w-12'} items-center justify-center rounded-xl bg-linear-to-br ${item.accent} text-white shadow-sm`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className={compact ? 'min-w-0 flex-1' : ''}>
              <span className={compact ? 'block text-[0.95rem] font-black leading-tight sm:text-base' : 'block text-sm font-bold'}>
                {item.label.replace(' Food', '').replace(' Services', '')}
              </span>
              <span className={compact ? 'mt-0.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400' : 'block text-xs text-slate-500 dark:text-slate-400'}>
                {compact ? item.mobileDescription : item.description.split('.')[0]}
              </span>
            </span>
            {selected ? <Check className={`h-4 w-4 ${compact ? 'text-blue-600' : 'text-blue-600'}`} /> : null}
          </button>
        )
      })}
      {errors.taskType ? <p className="text-sm text-red-500">{errors.taskType}</p> : null}
    </div>
  )

  const renderStoreSelect = () =>
    formData.taskType &&
    formData.taskType !== 'copy_notes' &&
    formData.taskType !== DRY_CLEANING_TASK_TYPE &&
    formData.taskType !== WATER_TASK_TYPE ? (
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">
          {formData.taskType === 'restaurant' ? 'Store/Restaurant' : 'Store'}
        </label>
        <select
          name="store"
          value={formData.store}
          onChange={handleInputChange}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 mb-4"
        >
          {selectedStores.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        {errors.store ? <p className="mt-2 text-sm text-red-500">{errors.store}</p> : null}
      </div>
    ) : null

  const renderSpeechButton = (tone: 'orange' | 'emerald' = 'orange') =>
    isSpeechSupported === true ? (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          pauseRealtime()
          if (isSpeechListening) {
            stopListening()
            return
          }
          startListening(formData.description)
        }}
        className={`h-10 rounded-full px-3 ${tone === 'orange' ? 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-200' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-200'} ${
          isSpeechListening ? 'animate-pulse ring-4 ring-blue-500/15' : ''
        }`}
      >
        {isSpeechListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
        {isSpeechListening ? 'Listening' : 'Voice'}
      </Button>
    ) : null

  const renderDetailsFields = (mobile = false) => (
    <div className="space-y-4">
      {mobile && formData.taskType === 'restaurant' ? null : renderStoreSelect()}

      {formData.taskType === 'restaurant' ? (
        <>
          {false ? (
            <button
              type="button"
              onClick={() => {
                pauseRealtime()
                setFormData((previous) => ({
                  ...previous,
                  cafeInquiry: !previous.cafeInquiry,
                  description: !previous.cafeInquiry ? '' : previous.description,
                  restaurantItemPrice: !previous.cafeInquiry ? '' : previous.restaurantItemPrice,
                  packaging: !previous.cafeInquiry ? '' : previous.packaging,
                  restaurantTakeawayCount: !previous.cafeInquiry ? '0' : previous.restaurantTakeawayCount,
                }))
                clearError('description')
                clearError('restaurantItemPrice')
              }}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                isCafeInquiry
                  ? 'border-blue-500 bg-blue-50 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <span className="block font-bold">Text me what is in cafe</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Adds {formatNaira(CAFE_INQUIRY_EXTRA_FEE)} if you want the tasker to check first.
              </span>
            </button>
          ) : null}
          {!isCafeInquiry ? (
            <div>
              {!mobile ? (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-bold text-slate-900 dark:text-slate-100">What do you need?</label>
                  {renderSpeechButton('orange')}
                </div>
              ) : null}
              <div className="relative">
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={mobile ? 5 : 3}
                  placeholder="E.g. Fried rice and chicken, no pepper"
                  className={`w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 ${
                    mobile ? 'pb-14 text-base font-semibold leading-relaxed' : ''
                  }`}
                />
                {mobile && isSpeechSupported === true ? (
                  <button
                    type="button"
                    onClick={() => {
                      pauseRealtime()
                      if (isSpeechListening) {
                        stopListening()
                        return
                      }
                      startListening(formData.description)
                    }}
                    className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 ${
                      isSpeechListening ? 'animate-pulse ring-4 ring-blue-500/20' : ''
                    }`}
                    aria-label={isSpeechListening ? 'Stop listening' : 'Say your order'}
                  >
                    {isSpeechListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {restaurantQuickOrders.slice(0, mobile ? 4 : 6).map((quickOrder) => (
                  <button
                    key={quickOrder}
                    type="button"
                    onClick={() => {
                      pauseRealtime()
                      setFormData((previous) => ({
                        ...previous,
                        description: previous.description ? `${previous.description}, ${quickOrder}` : quickOrder,
                      }))
                      clearError('description')
                    }}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                  >
                    {quickOrder}
                  </button>
                ))}
              </div>
              {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
            </div>
          ) : null}
          {!isCafeInquiry && !mobile ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">Food budget</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                <input
                  type="text"
                  inputMode="numeric"
                  name="restaurantItemPrice"
                  value={formData.restaurantItemPrice}
                  onChange={handleInputChange}
                  placeholder="1,500"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pl-8 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              {errors.restaurantItemPrice ? <p className="mt-2 text-sm text-red-500">{errors.restaurantItemPrice}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {formData.taskType === 'shopping' ? (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100">Items</label>
              {renderSpeechButton('emerald')}
            </div>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="E.g. Milo, biscuits, soap..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
            {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">Shopping budget</label>
            <input
              type="text"
              inputMode="numeric"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              placeholder="1,500"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
            {errors.amount ? <p className="mt-2 text-sm text-red-500">{errors.amount}</p> : null}
          </div>
        </>
      ) : null}

      {formData.taskType === DRY_CLEANING_TASK_TYPE ? (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100">Clothes and instructions</label>
              {renderSpeechButton('emerald')}
            </div>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="E.g. 3 shirts, 2 trousers, iron only, pickup from hostel..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
            {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">Dry cleaning budget</label>
            <input
              type="text"
              inputMode="numeric"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              placeholder="1,500"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
            {errors.amount ? <p className="mt-2 text-sm text-red-500">{errors.amount}</p> : null}
          </div>
        </>
      ) : null}

      {formData.taskType === PRINTING_TASK_TYPE ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: 'printing', label: 'Printing', price: PRINTING_PRICE_PER_PAGE },
            { value: 'photocopying', label: 'Photocopying', price: PHOTOCOPY_PRICE_PER_PAGE },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                pauseRealtime()
                setFormData((previous) => ({ ...previous, printingServiceType: option.value }))
                clearError('printingServiceType')
              }}
              className={`rounded-xl border p-3 text-left text-sm ${
                formData.printingServiceType === option.value
                  ? 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-100'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <span className="block font-bold">{option.label}</span>
              <span className="text-xs text-slate-500">{formatNaira(option.price)} per page</span>
            </button>
          ))}
          <input
            type="number"
            min="1"
            name="numberOfPages"
            value={formData.numberOfPages}
            onChange={handleInputChange}
            placeholder="Number of pages"
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900"
          />
          <select
            name="printingNeedsEditing"
            value={formData.printingNeedsEditing}
            onChange={handleInputChange}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900"
          >
            <option value="">Editing needed?</option>
            <option value="no">No editing</option>
            <option value="yes">Needs editing</option>
          </select>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            placeholder="Document name, color preference, paper size..."
            className="resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900 sm:col-span-2"
          />
          {(errors.printingServiceType || errors.numberOfPages || errors.printingNeedsEditing) ? (
            <p className="text-sm text-red-500 sm:col-span-2">{errors.printingServiceType || errors.numberOfPages || errors.printingNeedsEditing}</p>
          ) : null}
        </div>
      ) : null}

      {formData.taskType === 'copy_notes' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <select name="noteSize" value={formData.noteSize} onChange={handleInputChange} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900">
            <option value="">Note size</option>
            <option value="small">Small - {formatNaira(250)} every 2 pages</option>
            <option value="big">Big - {formatNaira(450)} every 2 pages</option>
          </select>
          <input type="number" min="1" name="numberOfPages" value={formData.numberOfPages} onChange={handleInputChange} placeholder="Pages" className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900" />
          <input type="datetime-local" min={getDateTimeInputValue()} name="deadline" value={formData.deadline} onChange={handleInputChange} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900" />
          {(errors.noteSize || errors.numberOfPages || errors.deadline) ? (
            <p className="text-sm text-red-500 sm:col-span-3">{errors.noteSize || errors.numberOfPages || errors.deadline}</p>
          ) : null}
        </div>
      ) : null}

      {formData.taskType === WATER_TASK_TYPE ? (
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">Number of bags</label>
          <input type="number" min="1" name="waterBags" value={formData.waterBags} onChange={handleInputChange} placeholder="How many bags?" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900" />
          <p className="mt-2 text-xs text-slate-500">Each bag is {formatNaira(WATER_BAG_PRICE)} plus {formatNaira(WATER_BAG_FEE)} fee.</p>
          {errors.waterBags ? <p className="mt-2 text-sm text-red-500">{errors.waterBags}</p> : null}
        </div>
      ) : null}
    </div>
  )

  const renderQuickDetails = () => (
    <div className="space-y-4">
      {formData.taskType === 'restaurant' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <label className="block text-sm font-black text-slate-950 dark:text-white">People</label>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              How many people are you ordering for?
            </p>
            <div className="mt-4 flex h-11 items-center justify-between gap-4">
              <span className="flex h-11 min-w-12 items-center text-2xl font-black leading-none text-slate-950 dark:text-white">
                {normalizedRestaurantPeopleCount}
              </span>
              <div className="flex h-11 items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, restaurantPeople: String(Math.max(1, normalizedRestaurantPeopleCount - 1)), restaurantTakeawayCount: '' }))}
                  className="flex h-11 w-12 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-900"
                  disabled={normalizedRestaurantPeopleCount <= 1}
                  aria-label="Reduce people count"
                >
                  <Minus className="h-4 w-4 stroke-[3]" />
                </button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
                <button
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, restaurantPeople: String(Math.min(RESTAURANT_MAX_PEOPLE, normalizedRestaurantPeopleCount + 1)), restaurantTakeawayCount: '' }))}
                  className="flex h-11 w-12 items-center justify-center bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={normalizedRestaurantPeopleCount >= RESTAURANT_MAX_PEOPLE}
                  aria-label="Increase people count"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">Packaging</label>
            <select
              name="packaging"
              value={formData.packaging === 'takeaway' ? 'takeaway' : 'cellophane'}
              onChange={(event) => {
                pauseRealtime()
                const isTakeaway = event.target.value === 'takeaway'
                setFormData((previous) => ({
                  ...previous,
                  packaging: event.target.value,
                  restaurantTakeawayCount: isTakeaway ? String(normalizedRestaurantPeopleCount) : '0',
                }))
                clearError('restaurantTakeawayCount')
              }}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="cellophane">Cellophane</option>
              <option value="takeaway">Takeaway</option>
            </select>
          </div>
        </div>
      ) : null}

      {formData.taskType === 'restaurant' ? (
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">How much will your food cost?</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
            <input
              type="text"
              inputMode="numeric"
              name="restaurantItemPrice"
              value={formData.restaurantItemPrice}
              onChange={handleInputChange}
              placeholder="1,500"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pl-8 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Don&apos;t forget to include price of takeaway if any.
          </p>
          {errors.restaurantItemPrice ? <p className="mt-2 text-sm text-red-500">{errors.restaurantItemPrice}</p> : null}
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-bold text-slate-900 dark:text-slate-100">Deliver to</label>
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleInputChange}
          placeholder="Hostel, room, block, or landmark"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {quickLocations.map((location) => (
            <button key={location} type="button" onClick={() => handleLocationSelect(location)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {location}
            </button>
          ))}
        </div>
        {errors.location ? <p className="mt-2 text-sm text-red-500">{errors.location}</p> : null}
      </div>
    </div>
  )

  const renderOrderSummary = () => (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-4">
        <span className="text-slate-500">Order</span>
        <span className="max-w-64 text-right font-semibold text-slate-900 dark:text-slate-100">
          {description || selectedTask.label}
        </span>
      </div>
      {selectedStoreLabel ? (
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Store</span>
          <span className="font-semibold">{selectedStoreLabel}</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">Location</span>
        <span className="text-right font-semibold">{formData.location || 'Not set'}</span>
      </div>
      {formData.taskType === 'restaurant' ? (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Person(s)</span>
            <span className="font-semibold">{normalizedRestaurantPeopleCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Packaging</span>
            <span className="font-semibold">{formData.packaging === 'takeaway' ? 'Takeaway' : 'Cellophane'}</span>
          </div>
        </>
      ) : null}
      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{pricing.pricingModel === 'water' ? 'Water and errand fee' : pricing.pricingModel === 'copy_notes' ? 'Copy notes price' : formData.taskType === 'restaurant' ? 'Food budget' : formData.taskType === DRY_CLEANING_TASK_TYPE ? 'Dry cleaning budget' : 'Budget'}</span>
          <span>{formatNaira(formData.taskType === 'restaurant' ? restaurantFoodBudget : pricing.amount)}</span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Service fee</span>
          {renderServiceFeeAmount('font-medium')}
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="font-bold text-slate-900 dark:text-white">Estimated Total</span>
          <span className="text-2xl font-black text-slate-950 dark:text-white">{formatNaira(displayedTotalAmount)}</span>
        </div>
      </div>
      {renderServiceFeeIncreaseNotice()}
    </div>
  )

  const renderTopNotices = () => (
    <div className="space-y-3 px-3 min-[390px]:px-4 lg:px-0">
      {renderServiceFeeIncreaseNotice()}
      {showLowTaskerAvailabilityNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-bold">Taskers may be in class right now</p>
          <p className="mt-1">Please try again by 2:00 PM for quicker attention.</p>
        </div>
      ) : null}
      {shouldShowDiscountCard ? (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 via-white to-cyan-50 px-4 py-4 text-slate-900 shadow-sm shadow-emerald-100/70 dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-cyan-950/30 dark:text-white dark:shadow-none">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black">Service fee discount available</p>
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
                  {discountOrderLabel} left
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                You won&apos;t pay the service fee on {discountOrderPhrase}.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The discount applies automatically when you review an eligible order.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {activeOrder ? (
        <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-blue-600">Active order</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{activeStatusLabel}</p>
            </div>
            <Button variant="outline" onClick={() => router.push(`/dashboard/tasks/${activeOrder._id}`)} className="h-9 rounded-lg">
              Track
            </Button>
          </div>
          {hasActiveOrderCompletionTimer ? (
            <div
              className={`mt-3 rounded-xl border px-3 py-3 text-sm ${
                activeOrderCompletionTimerExpired
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      {activeOrderCompletionTimerExpired
                        ? 'Timer expired'
                        : `${formatDuration(activeOrderCompletionRemainingMs)} left`}
                    </span>
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    {activeOrderCompletionTimerExpired
                      ? 'Time is up. Extra time can only be added before the timer runs out.'
                      : `${activeOrderCompletionWindowMinutes}${
                          activeOrderCompletionExtensionMinutes
                            ? ` + ${activeOrderCompletionExtensionMinutes}`
                            : ''
                        } min completion window`}
                  </p>
                </div>
                {!activeOrderCompletionTimerExpired ? (
                  <Button
                    type="button"
                    onClick={() => void handleExtendActiveOrderTimer()}
                    disabled={isExtendingActiveOrderTimer}
                    className="h-10 shrink-0 rounded-xl bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    {isExtendingActiveOrderTimer ? 'Adding...' : 'Add 10 min'}
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/80">
                <div
                  className={`h-full rounded-full ${
                    activeOrderCompletionTimerExpired ? 'bg-amber-500' : 'bg-sky-500'
                  }`}
                  style={{
                    width: `${
                      activeOrderCompletionTimerExpired
                        ? 100
                        : activeOrderCompletionProgress
                    }%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  const DesktopErrandWizard = () => (
    <section className="hidden lg:block" onClick={dismissNoticeOnWizardButtonClick}>
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl shadow-blue-100/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex min-h-44 items-center justify-between gap-8 bg-linear-to-r from-blue-50 via-white to-cyan-50 px-8 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <div>
            <div className="flex items-center gap-3 text-2xl font-black text-slate-950 dark:text-white">
              <img src="/logo.png" alt="Swiftdu" className="h-9 w-9 rounded-lg object-contain" />
              Swiftdu
            </div>
            <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-950 dark:text-white">What would you like to order today?</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">We will handle it, you relax.</p>
          </div>
        </div>

        <div className="space-y-6 px-8 py-7">
          <div>
            <p className="mb-3 text-sm font-black text-slate-950 dark:text-white">1. Choose a category</p>
            {renderCategoryCards(false)}
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-slate-950 dark:text-white">2. Tell us what you need</p>
            {renderDetailsFields(false)}
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-slate-950 dark:text-white">3. Add quick details</p>
            {renderQuickDetails()}
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid items-end gap-5 lg:grid-cols-[1fr_auto]">
              {renderOrderSummary()}
              <Button onClick={handleSubmit} disabled={isSubmitting} className="h-14 rounded-xl bg-blue-600 px-8 font-black text-white hover:bg-blue-700">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting...</> : <>Review & Place Order <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-xs">
            {[
              ['Fast', 'Place orders in seconds'],
              ['Transparent', 'See pricing upfront'],
              ['Reliable', 'Trusted taskers'],
              ['Secure', 'Safe order tracking'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="font-black text-slate-950 dark:text-white">{title}</p>
                <p className="mt-1 text-slate-500">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const MobileErrandWizard = () => (
    <section className="lg:hidden" onClick={dismissNoticeOnWizardButtonClick}>
      <div className="min-h-screen bg-transparent px-3 pb-6 pt-4 min-[390px]:px-4">
        <div className="mx-auto max-w-md">
          {step === 1 ? (
            <div>
              <h1 className="max-w-xs text-3xl font-black leading-[1.05] tracking-normal text-slate-950 dark:text-white min-[390px]:text-[2.35rem] sm:max-w-sm sm:text-5xl">
                What would you like to order?
              </h1>
              <p className="mt-3 max-w-xs text-base font-bold leading-snug text-slate-500 dark:text-slate-400 min-[390px]:text-lg">
                Pick a category and we will handle the rest.
              </p>
              <div className="mt-5">{renderCategoryCards(true)}</div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h1 className="text-3xl font-black leading-[1.05] text-slate-950 dark:text-white min-[390px]:text-[2.35rem]">
                {formData.taskType === 'restaurant' ? 'What do you want to eat?' : 'What do you need?'}
              </h1>
              {formData.taskType === 'restaurant' ? null : (
                <p className="mt-2 text-base font-bold text-slate-500">{selectedTask.description}</p>
              )}
              <div className="mt-5">{renderDetailsFields(true)}</div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h1 className="text-2xl font-black leading-tight text-slate-950 dark:text-white min-[390px]:text-3xl">Add quick details</h1>
              <div className="mt-5">{renderQuickDetails()}</div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <h1 className="text-2xl font-black leading-tight text-slate-950 dark:text-white min-[390px]:text-3xl">Review your order</h1>
              <div className="mt-5">{renderOrderSummary()}</div>
            </div>
          ) : null}
        </div>

        {step > 1 ? (
          <div className="mx-auto mt-6 max-w-md">
            {step === 2 && formData.taskType === 'restaurant' ? (
              <div className="mb-4">{renderStoreSelect()}</div>
            ) : null}
            {step < 4 ? (
            <Button
              onClick={handleNext}
              className="h-12 w-full rounded-xl bg-blue-600 font-black text-white hover:bg-blue-700"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-blue-600 font-black text-white hover:bg-blue-700"
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting...</> : 'Place Order'}
            </Button>
          )}
          </div>
        ) : null}
      </div>
    </section>
  )

  if (!mounted) return null

  return (
    <div className="min-h-screen px-4 py-4 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-0 lg:space-y-5">
        {renderTopNotices()}

        {isTasker ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">Tasker access enabled</span>
              <Button variant="outline" onClick={() => router.push('/tasker-dashboard')} className="h-9 rounded-lg border-emerald-200">
                Open
              </Button>
            </div>
          </div>
        ) : null}

        {excoDashboard ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">Executive access enabled</span>
              <Button variant="outline" onClick={() => router.push(excoDashboard.dashboardPath)} className="h-9 rounded-lg border-amber-200">
                Open
              </Button>
            </div>
          </div>
        ) : null}

        {DesktopErrandWizard()}
        {MobileErrandWizard()}

        {/* <div className="mx-auto max-w-4xl">
          <ProfileCompletionCard />
        </div> */}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="px-4 py-3 md:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-4xl">
          {showLowTaskerAvailabilityNotice ? (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 md:mb-8">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Taskers may be in class right now</p>
                  <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                    It may be unlikely to get a tasker quickly at this time because many taskers are in ongoing classes. Please try again by 2:00 PM for quicker attention.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {activeOrder ? (
            <div className="mb-5 rounded-3xl border border-indigo-200/80 bg-linear-to-r from-indigo-50 via-white to-cyan-50 p-4 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/40 dark:via-slate-900 dark:to-cyan-950/40 md:mb-8 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
                    Latest active order
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {activeStatusLabel}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    {activeStatusDescription}
                  </p>
                </div>
                <Button
                  onClick={() => router.push(`/dashboard/tasks/${activeOrder!._id}`)}
                  className="h-11 rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 px-4 text-white hover:from-indigo-700 hover:to-cyan-600"
                >
                  Open Tracker
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {isTasker ? (
            <div className="mb-5 rounded-3xl border border-emerald-200/80 bg-linear-to-r from-emerald-50 via-white to-teal-50 p-4 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/40 md:mb-8 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Tasker access enabled</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">You can use both dashboards.</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    Stay here to book errands, or switch to the tasker dashboard for active jobs.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/tasker-dashboard')}
                  className="h-11 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-4 text-white hover:from-emerald-700 hover:to-teal-700"
                >
                  Open Tasker Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {excoDashboard ? (
            <div className="mb-5 rounded-3xl border border-amber-200/80 bg-linear-to-r from-amber-50 via-white to-sky-50 p-4 shadow-sm dark:border-amber-900/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-sky-950/30 md:mb-8 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                    Executive access enabled
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    Open your {excoDashboard!.excoRole} dashboard.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    Review the metrics and decision signals for the {excoDashboard!.label} role.
                  </p>
                </div>
                <Button
                  onClick={() => router.push(excoDashboard!.dashboardPath)}
                  className="h-11 rounded-xl bg-linear-to-r from-amber-600 to-sky-600 px-4 text-white hover:from-amber-700 hover:to-sky-700"
                >
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Open Executive Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mb-5 grid gap-4 lg:mb-8 ">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 dark:shadow-slate-950/40 md:p-5">
              <div className="relative flex justify-between">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-slate-200 dark:border-slate-800" />
                <div
                  className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-indigo-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${((step - 1) / (stepTitles.length - 1)) * 100}%` }}
                />
                {stepTitles.map((title, index) => {
                  const currentStep = index + 1
                  const Icon = stepIcons[index]
                  const isActive = currentStep === step
                  const isCompleted = currentStep < step
                  return (
                    <div key={currentStep} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        isCompleted
                          ? 'border-transparent bg-linear-to-r from-indigo-500 to-cyan-500 text-white'
                          : isActive
                            ? 'border-indigo-500 bg-white text-indigo-600 shadow-lg shadow-indigo-500/25 dark:bg-slate-900 dark:text-indigo-300'
                            : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
                      }`}>
                        {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <span className={`hidden text-xs font-medium sm:block ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : isCompleted ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'
                      }`}>
                        {title}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 dark:shadow-slate-950/40 lg:hidden">
              <button
                type="button"
                onClick={() => setShowMobilePricing((previous) => !previous)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Pricing</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{mobilePricingSummary}</p>
                </div>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${showMobilePricing ? 'rotate-180' : ''}`} />
              </button>

              {showMobilePricing ? (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
                  {TIERED_SERVICE_FEE_RULES.map((rule) => (
                    <div key={rule.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                      <span className="text-slate-600 dark:text-slate-300">{rule.label}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">+{formatNaira(rule.fee)}</span>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-cyan-900 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-100">
                    Bag(s) of water cost {formatNaira(WATER_BAG_PRICE)} plus {formatNaira(WATER_BAG_FEE)} errand fee per bag.
                  </div>
                </div>
              ) : null}
            </div> */}
{/* 
            <div className="hidden rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 dark:shadow-slate-950/40 lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Pricing rules</p>
              <div className="mt-4 space-y-3 text-sm">
                {TIERED_SERVICE_FEE_RULES.map((rule) => (
                  <div key={rule.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                    <span className="text-slate-600 dark:text-slate-300">{rule.label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">+{formatNaira(rule.fee)}</span>
                  </div>
                ))}
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-cyan-900 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-100">
                  Bag(s) of water cost {formatNaira(WATER_BAG_PRICE)} plus {formatNaira(WATER_BAG_FEE)} errand fee per bag.
                </div>
              </div>
            </div> */}
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/50 bg-white/80 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/80 dark:shadow-slate-950/50">
            <div className="min-h-112 p-4 sm:p-5 md:min-h-120 md:p-8">
              {step === 1 ? (
                <div className="space-y-5 md:space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">What do you need?</h2>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Choose the category that fits this errand.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
                    {taskTypes.map((item) => {
                      const Icon = item.icon
                      const selected = formData.taskType === item.value
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => selectTaskType(item.value)}
                          className={`group relative rounded-2xl border-2 p-4 text-left transition-all duration-300 hover:scale-[1.02] sm:p-5 md:p-6 ${
                            selected
                              ? 'border-indigo-500 bg-linear-to-br from-indigo-50 to-cyan-50 shadow-lg shadow-indigo-500/10 dark:from-indigo-950/30 dark:to-cyan-950/20'
                              : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-700'
                          }`}
                        >
                          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${item.accent} text-white shadow-lg transition-transform group-hover:scale-110 sm:mb-4 sm:h-12 sm:w-12`}>
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">{item.label}</h3>
                          <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">{item.description}</p>
                          {selected ? <div className="absolute right-4 top-4 rounded-full bg-indigo-500 p-1 text-white"><Check className="h-4 w-4" /></div> : null}
                        </button>
                      )
                    })}
                  </div>
                  {errors.taskType ? <p className="text-center text-sm text-red-500">{errors.taskType}</p> : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4 md:space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Errand Details</h2>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Tell us what you need. Restaurant orders now stay on one simple screen.</p>
                  </div>
                  {formData.taskType &&
                  formData.taskType !== 'others' &&
                  formData.taskType !== 'copy_notes' &&
                  formData.taskType !== DRY_CLEANING_TASK_TYPE &&
                  formData.taskType !== WATER_TASK_TYPE ? (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Store className="h-4 w-4 text-indigo-500" />Select Store</label>
                      <select name="store" value={formData.store} onChange={handleInputChange} className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800">
                        {selectedStores.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      {errors.store ? <p className="mt-2 text-sm text-red-500">{errors.store}</p> : null}
                    </div>
                  ) : null}
                  {formData.taskType === 'copy_notes' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><FileText className="h-4 w-4 text-amber-500" />Note Size</label>
                        <select name="noteSize" value={formData.noteSize} onChange={handleInputChange} className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-slate-700 dark:bg-slate-800">
                          <option value="">Select note size...</option>
                          <option value="small">Small - {formatNaira(250)} every 2 pages</option>
                          <option value="big">Big - {formatNaira(450)} every 2 pages</option>
                        </select>
                        {errors.noteSize ? <p className="mt-2 text-sm text-red-500">{errors.noteSize}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><FileText className="h-4 w-4 text-amber-500" />Number of Pages</label>
                        <input type="number" min="1" name="numberOfPages" value={formData.numberOfPages} onChange={handleInputChange} placeholder="How many pages?" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-slate-700 dark:bg-slate-800" />
                        {errors.numberOfPages ? <p className="mt-2 text-sm text-red-500">{errors.numberOfPages}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Clock className="h-4 w-4 text-amber-500" />
                          Deadline
                        </label>
                        <input
                          type="datetime-local"
                          min={getDateTimeInputValue()}
                          name="deadline"
                          value={formData.deadline}
                          onChange={handleInputChange}
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        {errors.deadline ? <p className="mt-2 text-sm text-red-500">{errors.deadline}</p> : null}
                      </div>
                      {pricing.pricingModel === 'copy_notes' && numberOfPages > 0 ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:col-span-2">
                          Total is {formatNaira(displayedTotalAmount)}.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {formData.taskType === PRINTING_TASK_TYPE ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
                        Printing is {formatNaira(PRINTING_PRICE_PER_PAGE)} per page.
                        Photocopying is {formatNaira(PHOTOCOPY_PRICE_PER_PAGE)} per page.
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <FileText className="h-4 w-4 text-sky-500" />
                          Service Type
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            {
                              value: 'printing',
                              label: 'Printing',
                              price: PRINTING_PRICE_PER_PAGE,
                            },
                            {
                              value: 'photocopying',
                              label: 'Photocopying',
                              price: PHOTOCOPY_PRICE_PER_PAGE,
                            },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({
                                  ...previous,
                                  printingServiceType: option.value,
                                }))
                                clearError('printingServiceType')
                              }}
                              className={`rounded-xl border-2 p-4 text-left transition ${
                                formData.printingServiceType === option.value
                                  ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200'
                                  : 'border-slate-200 hover:border-sky-300 dark:border-slate-700 dark:hover:border-sky-700'
                              }`}
                            >
                              <div className="font-medium">{option.label}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {formatNaira(option.price)} per page
                              </div>
                            </button>
                          ))}
                        </div>
                        {errors.printingServiceType ? <p className="mt-2 text-sm text-red-500">{errors.printingServiceType}</p> : null}
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <FileText className="h-4 w-4 text-sky-500" />
                          Number of Pages
                        </label>
                        <input
                          type="number"
                          min="1"
                          name="numberOfPages"
                          value={formData.numberOfPages}
                          onChange={handleInputChange}
                          placeholder="How many pages?"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        {errors.numberOfPages ? <p className="mt-2 text-sm text-red-500">{errors.numberOfPages}</p> : null}
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <FileText className="h-4 w-4 text-sky-500" />
                          Any Editing Needed?
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            { value: 'no', label: 'No' },
                            { value: 'yes', label: 'Yes' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({
                                  ...previous,
                                  printingNeedsEditing: option.value,
                                }))
                                clearError('printingNeedsEditing')
                              }}
                              className={`rounded-xl border-2 p-4 text-center font-medium transition ${
                                formData.printingNeedsEditing === option.value
                                  ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200'
                                  : 'border-slate-200 hover:border-sky-300 dark:border-slate-700 dark:hover:border-sky-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {errors.printingNeedsEditing ? <p className="mt-2 text-sm text-red-500">{errors.printingNeedsEditing}</p> : null}
                        {formData.printingNeedsEditing === 'yes' ? (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                            This price is tentative. An extra amount may be added for editing the work.
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <FileText className="h-4 w-4 text-sky-500" />
                          Work Details
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          rows={3}
                          placeholder="Add document name, paper size, color preference, or other instructions..."
                          className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>

                      {pricing.amount > 0 ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
                          {printingLabel} total is {formatNaira(pricing.amount)} before SwiftDU service fee.
                          {shouldShowTieredServiceFee ? (
                            <span className="block pt-1 font-semibold">
                              Service fee for this job is {formatNaira(displayedServiceFee)}.
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {formData.taskType === WATER_TASK_TYPE ? (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Droplets className="h-4 w-4 text-cyan-500" />Number of Bags</label>
                      <input type="number" min="1" name="waterBags" value={formData.waterBags} onChange={handleInputChange} placeholder="How many bags?" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800" />
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Each bag is {formatNaira(WATER_BAG_PRICE)} plus a {formatNaira(WATER_BAG_FEE)} errand fee. 
                      </p>
                      {pricing.pricingModel === 'water' && waterBags > 0 ? (
                        <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100">
                          Total is {formatNaira(displayedTotalAmount)}.
                        </div>
                      ) : null}
                      {errors.waterBags ? <p className="mt-2 text-sm text-red-500">{errors.waterBags}</p> : null}
                    </div>
                  ) : null}
                  {formData.taskType === 'restaurant' ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => {
                          pauseRealtime()
                          setFormData((previous) => ({
                            ...previous,
                            cafeInquiry: !previous.cafeInquiry,
                            description: !previous.cafeInquiry ? '' : previous.description,
                            restaurantItemPrice: !previous.cafeInquiry ? '' : previous.restaurantItemPrice,
                            packaging: !previous.cafeInquiry ? '' : previous.packaging,
                            restaurantTakeawayCount: !previous.cafeInquiry ? '0' : previous.restaurantTakeawayCount,
                          }))
                          clearError('description')
                          clearError('restaurantItemPrice')
                        }}
                        className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition ${
                          isCafeInquiry
                            ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <span className="block font-bold">Text me what is in cafe</span>
                        <span className="mt-1 block text-sm">
                          Adds {formatNaira(CAFE_INQUIRY_EXTRA_FEE)} to the normal restaurant service fee. You can add your food description and budget after the tasker checks the cafe.
                        </span>
                      </button>
                      {!isCafeInquiry ? (
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <ShoppingBag className="h-4 w-4 text-blue-500" />
                          Order description
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Describe what you want. Example: Rice and chicken, drink, snacks..."
                          rows={4}
                          className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {restaurantQuickOrders.map((quickOrder) => (
                            <button
                              key={quickOrder}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({
                                  ...previous,
                                  description: previous.description
                                    ? `${previous.description}, ${quickOrder}`
                                    : quickOrder,
                                }))
                                clearError('description')
                              }}
                              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                            >
                              {quickOrder}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Tap a popular food, use the microphone, or type manually.
                        </p>
                        {isSpeechSupported === true ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              pauseRealtime()
                              if (isSpeechListening) {
                                stopListening()
                                return
                              }
                              startListening(formData.description)
                            }}
                            className={`mt-3 h-11 w-full rounded-xl border-2 border-blue-200 bg-blue-50 px-4 font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50 sm:w-auto ${
                              isSpeechListening ? 'animate-pulse ring-4 ring-blue-500/15' : ''
                            }`}
                          >
                            {isSpeechListening ? (
                              <>
                                <MicOff className="mr-2 h-4 w-4" />
                                Listening...
                              </>
                            ) : (
                              <>
                                <Mic className="mr-2 h-4 w-4" />
                                Say your order
                              </>
                            )}
                          </Button>
                        ) : isSpeechSupported === false ? (
                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Speech input is not supported on this browser.
                          </p>
                        ) : null}
                        {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
                      </div>
                      ) : null}
                      {!isCafeInquiry ? (
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Wallet className="h-4 w-4 text-blue-500" />
                          Budget
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="restaurantItemPrice"
                            value={formData.restaurantItemPrice}
                            onChange={handleInputChange}
                            placeholder="1,500"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-9 font-mono text-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          How much will the food cost?
                        </p>
                        <p className="mt-1 text-sm font-medium text-blue-700 dark:text-blue-300 pb-2">
                          Add only the food price here. If you are not sure, use &quot;Text me what is in cafe&quot; above.
                        </p>
                        {errors.restaurantItemPrice ? <p className="mt-2 text-sm text-red-500">{errors.restaurantItemPrice}</p> : null}
                      </div>
                      ) : null}
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Wallet className="h-4 w-4 text-blue-500" />
                          Number of Orders
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: RESTAURANT_MAX_PEOPLE }, (_, index) => String(index + 1)).map((people) => (
                            <button
                              key={people}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({
                                  ...previous,
                                  restaurantPeople: people,
                                  packaging: '',
                                  restaurantTakeawayCount: '',
                                }))
                                clearError('restaurantPeople')
                                clearError('restaurantTakeawayCount')
                              }}
                              className={`h-12 rounded-xl border-2 text-sm font-bold transition ${
                                formData.restaurantPeople === people
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/30 dark:text-blue-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700'
                              }`}
                            >
                              {people}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          How many people are you ordering for?
                        </p>
                        {errors.restaurantPeople ? <p className="mt-2 text-sm text-red-500">{errors.restaurantPeople}</p> : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                              <ShoppingBag className="h-4 w-4 text-blue-500" />
                              Packaging
                            </label>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Choose it here so the restaurant order stays fast and simple.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updatePackagingLanguage(packagingLanguage === 'english' ? 'pidgin' : 'english')}
                            className="shrink-0 rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-200 dark:hover:bg-blue-950/30"
                          >
                            {packagingCopy.languageButton}
                          </button>
                        </div>

                        <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {normalizedRestaurantPeopleCount === 1
                            ? packagingCopy.singleQuestion
                            : packagingCopy.multipleQuestion}
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => {
                              pauseRealtime()
                              setFormData((previous) => ({
                                ...previous,
                                packaging: 'takeaway',
                                restaurantTakeawayCount: String(normalizedRestaurantPeopleCount),
                              }))
                              clearError('restaurantTakeawayCount')
                            }}
                            className={`rounded-xl border-2 p-3 text-left font-semibold transition ${
                              formData.packaging === 'takeaway' ||
                              normalizedRestaurantTakeawayCount === normalizedRestaurantPeopleCount
                                ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-100'
                                : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700'
                            }`}
                          >
                            {normalizedRestaurantPeopleCount === 1
                              ? packagingCopy.singleTakeaway
                              : packagingCopy.allTakeaway}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              pauseRealtime()
                              setFormData((previous) => ({
                                ...previous,
                                packaging: 'cellophane',
                                restaurantTakeawayCount: '0',
                              }))
                              clearError('restaurantTakeawayCount')
                            }}
                            className={`rounded-xl border-2 p-3 text-left font-semibold transition ${
                              formData.packaging === 'cellophane' ||
                              (formData.restaurantTakeawayCount === '0' && normalizedRestaurantTakeawayCount === 0)
                                ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-100'
                                : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700'
                            }`}
                          >
                            {packagingCopy.singleCellophane}
                          </button>
                        </div>

                        {normalizedRestaurantPeopleCount > 1 ? (
                          <div className="mt-3">
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {packagingCopy.takeawayCountQuestion}
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {Array.from({ length: normalizedRestaurantPeopleCount + 1 }, (_, index) => String(index)).map((count) => (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => {
                                    pauseRealtime()
                                    setFormData((previous) => ({
                                      ...previous,
                                      packaging: Number(count) === normalizedRestaurantPeopleCount ? 'takeaway' : Number(count) === 0 ? 'cellophane' : 'mixed',
                                      restaurantTakeawayCount: count,
                                    }))
                                    clearError('restaurantTakeawayCount')
                                  }}
                                  className={`h-11 rounded-xl border-2 text-sm font-bold transition ${
                                    formData.restaurantTakeawayCount === count
                                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700'
                                  }`}
                                >
                                  {count}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                          {packagingCopy.packagingLabel}: <span className="font-semibold">{restaurantPackagingNote}</span>
                        </div>
                        {errors.restaurantTakeawayCount ? <p className="mt-2 text-sm text-red-500">{errors.restaurantTakeawayCount}</p> : null}
                      </div>

                      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                        <span className="block pt-1 font-semibold">
                          {isCafeInquiry
                            ? `Tasker will notify you of available food before you make a decision.`
                            : 'If taskers notice the food is for multiple people, they can update your order price before you pay.'}
                        </span>
                        {shouldShowTieredServiceFee ? (
                          <span className="block pt-1 font-semibold">
                            Service fee for this budget is {formatNaira(displayedServiceFee)}.
                          </span>
                        ) : null}
                      </div>
                      {waterWarning ? (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                          Choose the bag of water task for water delivery.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {formData.taskType === 'shopping' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Store className="h-4 w-4 text-emerald-500" />
                          Items description
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Describe what you want. Example: Milo, biscuits, soap, tissue..."
                          rows={4}
                          className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Tap the microphone to say your order or type manually.
                        </p>
                        {isSpeechSupported === true ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              pauseRealtime()
                              if (isSpeechListening) {
                                stopListening()
                                return
                              }
                              startListening(formData.description)
                            }}
                            className={`mt-3 h-11 w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 sm:w-auto ${
                              isSpeechListening ? 'animate-pulse ring-4 ring-emerald-500/15' : ''
                            }`}
                          >
                            {isSpeechListening ? (
                              <>
                                <MicOff className="mr-2 h-4 w-4" />
                                Listening...
                              </>
                            ) : (
                              <>
                                <Mic className="mr-2 h-4 w-4" />
                                Say your order
                              </>
                            )}
                          </Button>
                        ) : isSpeechSupported === false ? (
                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Speech input is not supported on this browser.
                          </p>
                        ) : null}
                        {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Wallet className="h-4 w-4 text-emerald-500" />
                          Budget
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            placeholder="1,500"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-9 font-mono text-lg outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          How much should the store items cost?
                        </p>
                        {errors.amount ? <p className="mt-2 text-sm text-red-500">{errors.amount}</p> : null}
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                        Item budget is {formatNaira(shoppingBudget)} before SwiftDU service fee.
                        {shouldShowTieredServiceFee ? (
                          <span className="block pt-1 font-semibold">
                            Service fee for this budget is {formatNaira(displayedServiceFee)}.
                          </span>
                        ) : null}
                      </div>
                      {waterWarning ? (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                          Choose the bag of water task for water delivery.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {formData.taskType === DRY_CLEANING_TASK_TYPE ? (
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Shirt className="h-4 w-4 text-cyan-500" />
                          Clothes and instructions
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Describe the clothes, pickup details, stains, ironing, or delivery instructions..."
                          rows={4}
                          className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Include item count and whether you need washing, ironing, or pickup/dropoff.
                        </p>
                        {isSpeechSupported === true ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              pauseRealtime()
                              if (isSpeechListening) {
                                stopListening()
                                return
                              }
                              startListening(formData.description)
                            }}
                            className={`mt-3 h-11 w-full rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 font-semibold text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200 dark:hover:bg-cyan-950/50 sm:w-auto ${
                              isSpeechListening ? 'animate-pulse ring-4 ring-cyan-500/15' : ''
                            }`}
                          >
                            {isSpeechListening ? (
                              <>
                                <MicOff className="mr-2 h-4 w-4" />
                                Listening...
                              </>
                            ) : (
                              <>
                                <Mic className="mr-2 h-4 w-4" />
                                Say your laundry request
                              </>
                            )}
                          </Button>
                        ) : null}
                        {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Wallet className="h-4 w-4 text-cyan-500" />
                          Dry cleaning budget
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">â‚¦</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            placeholder="1,500"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-9 font-mono text-lg outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Estimate what the laundry service should cost before SwiftDU service fee.
                        </p>
                        {errors.amount ? <p className="mt-2 text-sm text-red-500">{errors.amount}</p> : null}
                      </div>
                      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100">
                        Dry cleaning budget is {formatNaira(shoppingBudget)} before SwiftDU service fee.
                        {shouldShowTieredServiceFee ? (
                          <span className="block pt-1 font-semibold">
                            Service fee for this budget is {formatNaira(displayedServiceFee)}.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {formData.taskType !== WATER_TASK_TYPE && formData.taskType !== 'restaurant' && formData.taskType !== 'shopping' && formData.taskType !== DRY_CLEANING_TASK_TYPE && formData.taskType !== PRINTING_TASK_TYPE ? (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <FileText className="h-4 w-4 text-indigo-500" />
                        Description
                      </label>

                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder="Describe exactly what should be bought or delivered..."
                        className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800"
                      />

                      {waterWarning ? (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                          Choose the bag of water task for water delivery.
                        </div>
                      ) : null}

                      {errors.description ? (
                        <p className="mt-2 text-sm text-red-500">{errors.description}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {formData.taskType !== 'copy_notes' && formData.taskType !== 'restaurant' && formData.taskType !== 'shopping' && formData.taskType !== DRY_CLEANING_TASK_TYPE && formData.taskType !== WATER_TASK_TYPE && formData.taskType !== PRINTING_TASK_TYPE ? (
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Wallet className="h-4 w-4 text-indigo-500" />Item Budget (NGN)</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                      <input type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="1,500" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-9 font-mono text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800" />
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">SwiftDU adds the delivery fee to the total you will later transfer to the tasker.</p>
                    {shouldShowTieredServiceFee ? (
                      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
                        Service fee for this budget is {formatNaira(displayedServiceFee)}.
                      </div>
                    ) : null}
                    {errors.amount ? <p className="mt-2 text-sm text-red-500">{errors.amount}</p> : null}
                  </div>
                  ) : null}
                </div>
              ) : null}

              {step === packagingStep ? (
                <div className="space-y-5 md:space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Packaging</h2>
                      <p className="mt-2 text-slate-500 dark:text-slate-400">
                        {packagingCopy.subtitle}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updatePackagingLanguage(
                          packagingLanguage === 'english' ? 'pidgin' : 'english'
                        )
                      }
                      className="h-10 w-fit border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-200 dark:hover:bg-blue-950/30"
                    >
                      {packagingCopy.languageButton}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                      <TypeTypingEffect
                        text={
                          normalizedRestaurantPeopleCount === 1
                            ? packagingCopy.singleQuestion
                            : packagingCopy.multipleQuestion
                        }
                        speed={25}
                        className="block whitespace-pre-line leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          pauseRealtime()
                          setFormData((previous) => ({
                            ...previous,
                            packaging: 'Takeaway pack',
                            restaurantTakeawayCount: String(normalizedRestaurantPeopleCount),
                          }))
                          clearError('restaurantTakeawayCount')
                        }}
                        className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold transition ${
                          normalizedRestaurantTakeawayCount === normalizedRestaurantPeopleCount &&
                          formData.packaging !== 'mixed'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/30 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700'
                        }`}
                      >
                        {normalizedRestaurantPeopleCount === 1
                          ? packagingCopy.singleTakeaway
                          : packagingCopy.allTakeaway}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          pauseRealtime()
                          setFormData((previous) => ({
                            ...previous,
                            packaging:
                              normalizedRestaurantPeopleCount === 1 ? 'Cellophane' : 'mixed',
                            restaurantTakeawayCount:
                              normalizedRestaurantPeopleCount === 1 ? '0' : '',
                          }))
                          clearError('restaurantTakeawayCount')
                        }}
                        className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold transition ${
                          (normalizedRestaurantPeopleCount === 1 &&
                            normalizedRestaurantTakeawayCount === 0 &&
                            formData.packaging === 'Cellophane') ||
                          formData.packaging === 'mixed'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/30 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700'
                        }`}
                      >
                        {normalizedRestaurantPeopleCount === 1
                          ? packagingCopy.singleCellophane
                          : packagingCopy.mixedPrompt}
                      </button>
                    </div>

                    {normalizedRestaurantPeopleCount > 1 && formData.packaging === 'mixed' ? (
                      <>
                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                          <TypeTypingEffect
                            text={packagingCopy.takeawayCountQuestion}
                            speed={25}
                            className="block whitespace-pre-line leading-relaxed"
                          />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {Array.from(
                            { length: Math.max(normalizedRestaurantPeopleCount - 1, 1) },
                            (_, index) => index + 1
                          ).map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({
                                  ...previous,
                                  restaurantTakeawayCount: String(count),
                                }))
                                clearError('restaurantTakeawayCount')
                              }}
                              className={`h-11 min-w-11 rounded-full border-2 px-4 text-sm font-bold transition ${
                                formData.restaurantTakeawayCount === String(count)
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/30 dark:text-blue-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {errors.restaurantTakeawayCount ? (
                      <p className="text-sm text-red-500">{errors.restaurantTakeawayCount}</p>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                      {packagingCopy.packagingLabel}: <span className="font-semibold">{restaurantPackagingNote}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === deliveryStep ? (
                <div className="space-y-4 md:space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Delivery Info</h2>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Set the deadline and location.</p>
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><MapPin className="h-4 w-4 text-indigo-500" />Delivery Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="Library 2nd Floor, Hall B Room 204..." className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800" />
                    {errors.location ? <p className="mt-2 text-sm text-red-500">{errors.location}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Amnesty Hostel', 'Girls Hostel', 'Staff Quarters', 'PLT', 'Lecturers Block', 'Bursary', 'NDDC Auditorium', 'Library'].map((location) => (
                      <button key={location} type="button" onClick={() => handleLocationSelect(location)} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-indigo-100 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400">
                        {location}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === reviewStep ? (
                <div className="space-y-5 md:space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Review Your Task</h2>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Confirm the details and exact amount to be collected.</p>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{taskTypes.find((item) => item.value === formData.taskType)?.label}</p>
                        {selectedStoreLabel ? <p className="text-sm text-slate-500 dark:text-slate-400">{selectedStoreLabel}</p> : null}
                      </div>
                      <button type="button" onClick={() => handleEditStep(1)} className="text-sm font-medium text-indigo-500 hover:text-indigo-600">Edit</button>
                    </div>
                    <div className="space-y-3 text-sm">
                      {formData.taskType === 'restaurant' && formData.description ? (
                        <div className="flex justify-between gap-6">
                          <span className="text-slate-500">Description</span>
                          <span className="max-w-[22rem] text-right text-slate-900 dark:text-slate-100">
                            {formData.description}
                          </span>
                        </div>
                      ) : null}
                      {formData.taskType === 'shopping' && formData.description ? (
                        <div className="flex justify-between gap-6">
                          <span className="text-slate-500">Description</span>
                          <span className="max-w-[22rem] text-right text-slate-900 dark:text-slate-100">
                            {formData.description}
                          </span>
                        </div>
                      ) : null}
                      {formData.taskType !== 'restaurant' && formData.taskType !== 'shopping' && formData.description ? <div className="flex justify-between gap-6"><span className="text-slate-500">Description</span><span className="max-w-[18rem] text-right text-slate-900 dark:text-slate-100">{formData.description}</span></div> : null}
                      <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Location</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.location}</span></div>
                      {formData.taskType === 'restaurant' ? <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">People</span><span className="text-right text-slate-900 dark:text-slate-100">{normalizedRestaurantPeopleCount}</span></div> : null}
                      {formData.taskType === 'restaurant' ? <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Packaging</span><span className="text-right text-slate-900 dark:text-slate-100">{normalizedRestaurantTakeawayCount > 0 ? `${normalizedRestaurantTakeawayCount} takeaway${normalizedRestaurantTakeawayCount === 1 ? '' : 's'}` : 'Cellophane'}</span></div> : null}
                      {formData.taskType === WATER_TASK_TYPE ? <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Water bags</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.waterBags}</span></div> : null}
                      {formData.taskType === PRINTING_TASK_TYPE ? (
                        <>
                          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Service</span><span className="text-right text-slate-900 dark:text-slate-100">{printingLabel}</span></div>
                          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Pages</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.numberOfPages}</span></div>
                          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Editing</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.printingNeedsEditing === 'yes' ? 'Yes' : 'No'}</span></div>
                          {formData.printingNeedsEditing === 'yes' ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                              This price is tentative. An extra amount may be added for editing the work.
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {formData.taskType === 'copy_notes' ? (
                        <>
                          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Note size</span><span className="text-right capitalize text-slate-900 dark:text-slate-100">{formData.noteSize}</span></div>
                          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Pages</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.numberOfPages}</span></div>
                          <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Deadline</span><span className="text-right text-slate-900 dark:text-slate-100">{formatReadyDate(formData.deadline)}</span></div>
                        </>
                      ) : null}
                    </div>
                    <div className="space-y-3 border-t-2 border-slate-200 pt-6 dark:border-slate-700">
                      {hasAvailableServiceFeeDiscount ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                          <p className="font-semibold">Service fee discount applied</p>
                          <p className="mt-1">
                            You have a discount on {discountOrderPhrase}, so you won&apos;t pay the service fee for this order.
                          </p>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-sm"><span className="text-slate-500">{pricing.pricingModel === 'copy_notes' ? 'Copy notes price' : pricing.pricingModel === 'water' ? 'Water budget + tasker fee' : formData.taskType === PRINTING_TASK_TYPE ? `${printingLabel} price` : formData.taskType === 'restaurant' ? 'Food budget' : formData.taskType === 'shopping' ? 'Store item budget' : formData.taskType === DRY_CLEANING_TASK_TYPE ? 'Dry cleaning budget' : 'Item budget'}</span><span className="font-medium">{formatNaira(formData.taskType === 'restaurant' ? restaurantFoodBudget : pricing.amount)}</span></div>
                      {formData.taskType === 'restaurant' ? <div className="flex justify-between text-sm"><span className="text-slate-500">Packaging</span><span className="font-medium">{restaurantPackagingNote}</span></div> : null}
                      <div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">{pricing.pricingModel === 'water' ? 'SwiftDU fee (24% of errand fee)' : pricing.pricingModel === 'copy_notes' ? 'SwiftDU fee' : 'Service fee'}</span>{renderServiceFeeAmount('font-medium')}</div>
                      {renderServiceFeeIncreaseNotice()}
                      <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700"><span className="font-bold text-slate-900 dark:text-white">Total to pay</span><span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatNaira(displayedTotalAmount)}</span></div>
                    </div>
                  </div>
                  {formData.taskType === 'restaurant' ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/70 dark:text-blue-300"><Info className="h-4 w-4" /></div>
                        <p>If a tasker notices this restaurant order is for multiple people, they can update the price before you pay.</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/50 px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-900/50 sm:px-5 sm:pb-5 md:px-8 md:pb-8">
              <div className="flex gap-3">
                {step > 1 ? <Button variant="outline" onClick={handleBack} disabled={isSubmitting} className="h-12 flex-1 rounded-xl border-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="mr-2 h-4 w-4" />Back</Button> : null}
                {step > 1 && step < reviewStep ? (
                  <Button onClick={handleNext} className="h-12 flex-1 rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-cyan-600">
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : step === reviewStep ? (
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="h-12 flex-1 rounded-xl bg-linear-to-r from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-cyan-600">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting...</> : <>Post Task<ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <ProfileCompletionCard />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 sm:mt-8 sm:gap-6 sm:text-sm">
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span>Verified Taskers</span></div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-500" /><span>Secure Order Tracking</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
