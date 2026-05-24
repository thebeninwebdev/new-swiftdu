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
  ShieldCheck,
  ShoppingBag,
  Store,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ProfileCompletionCard } from '@/components/profile-completion-card'
import { authClient } from '@/lib/auth-client'
import {
  calculateOrderPricing,
  descriptionMentionsWater,
  PHOTOCOPY_PRICE_PER_PAGE,
  PRINTING_PRICE_PER_PAGE,
  PRINTING_TASK_TYPE,
  RESTAURANT_MAX_PEOPLE,
  WATER_BAG_PRICE,
  WATER_BAG_FEE,
  WATER_TASK_TYPE,
} from '@/lib/pricing'

const ACTIVE_ORDER_REFRESH_MS = 4000
const REALTIME_PAUSE_MS = 1200
const STT_MAX_RECORDING_MS = 120_000

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
  restaurantItemPrice: string
  restaurantPeople: string
  shoppingItems: RestaurantItem[]
  shoppingItemName: string
  shoppingItemPrice: string
}

interface RestaurantItem {
  id: string
  name: string
  price: number
}

interface ActiveOrder {
  _id: string
  taskType: string
  description: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  taskerId?: string | null
}

interface TaskTypeConfig {
  value: string
  label: string
  description: string
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
    icon: ShoppingBag,
    accent: 'from-orange-500 to-rose-500',
  },
  {
    value: 'printing',
    label: 'Printing Services',
    description: 'Notes, assignments, and document printing.',
    icon: FileText,
    accent: 'from-sky-500 to-indigo-500',
  },
  {
    value: 'copy_notes',
    label: 'Copy Notes',
    description: 'Copy small or big notes by page count.',
    icon: FileText,
    accent: 'from-amber-500 to-yellow-500',
  },
  {
    value: 'shopping',
    label: 'Store Shopping',
    description: 'Groceries, toiletries, and small campus-store items.',
    icon: Store,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    value: WATER_TASK_TYPE,
    label: 'Bag of Water',
    description: 'Order bags of water at a fixed per-bag price.',
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
    { value: 'akpan', label: 'Akpan Store' },
    { value: 'mama', label: "Mama's Kitchen" },
    { value: 'golley', label: 'Golley Shop' },
    { value: 'indomie', label: 'Indomie Spot' },
  ],
}

const restaurantPackagingOptions = [
  { value: '', label: 'No takeaway pack' },
  { value: 'Takeaway pack', label: 'Takeaway pack' },
]

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
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

function isLowTaskerAvailabilityWindow(date: Date) {
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

function combineDescription(baseText: string, transcript: string) {
  const nextTranscript = transcript.trim()
  if (!baseText.trim()) return nextTranscript
  if (!nextTranscript) return baseText
  return `${baseText.trim()}\n${nextTranscript}`
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

function stopMediaRecorder(recorder: MediaRecorder | null) {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop()
  }
}

export default function ErrandWizardPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRealtimePaused, setIsRealtimePaused] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [excoDashboard, setExcoDashboard] = useState<ExcoDashboardAccess | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimeoutRef = useRef<number | null>(null)
  const recordingBaseTextRef = useRef('')
  const fetchingActiveOrderRef = useRef(false)
  const isRealtimePausedRef = useRef(false)
  const realtimeResumeTimeoutRef = useRef<number | null>(null)
  const isTasker = session?.user.role === 'tasker'

  const [formData, setFormData] = useState<ErrandData>({
    taskType: '',
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
    restaurantItemPrice: '',
    restaurantPeople: '1',
    shoppingItems: [],
    shoppingItemName: '',
    shoppingItemPrice: '',
  })
  const [isRecordingOrder, setIsRecordingOrder] = useState(false)
  const [isTranscribingOrder, setIsTranscribingOrder] = useState(false)
  const sessionUserId = session?.user?.id

  const fetchCurrentOrder = useCallback(async () => {
    if (fetchingActiveOrderRef.current) return
    fetchingActiveOrderRef.current = true

    try {
      const response = await fetch('/api/orders?current=true')
      if (!response.ok) throw new Error('Failed to fetch current order')
      const data = await response.json()
      setActiveOrder(data)
    } catch {
      setActiveOrder(null)
    } finally {
      fetchingActiveOrderRef.current = false
    }
  }, [])

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
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

    const interval = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)

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

    const interval = window.setInterval(() => {
      if (!isRealtimePausedRef.current && document.visibilityState === 'visible') {
        void fetchCurrentOrder()
      }
    }, ACTIVE_ORDER_REFRESH_MS)

    const onFocus = () => {
      if (!isRealtimePausedRef.current && document.visibilityState === 'visible') {
        void fetchCurrentOrder()
      }
    }

    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(interval)
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

    socket.on('order:updated', (payload?: { _id?: string }) => {
      if (!payload?._id || payload._id === activeOrderId) {
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
  }, [activeOrder?._id, disconnectSocket, fetchCurrentOrder, isRealtimePaused, mounted])

  useEffect(() => {
    return () => {
      if (realtimeResumeTimeoutRef.current) {
        window.clearTimeout(realtimeResumeTimeoutRef.current)
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current)
      }
      stopMediaRecorder(mediaRecorderRef.current)
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      disconnectSocket()
    }
  }, [disconnectSocket])

  const restaurantFoodBudget = parseMoneyInput(formData.restaurantItemPrice)
  const restaurantPeopleCount = Number(formData.restaurantPeople || 1)
  const normalizedRestaurantPeopleCount =
    Number.isInteger(restaurantPeopleCount) && restaurantPeopleCount > 0
      ? restaurantPeopleCount
      : 1
  const restaurantBudget = restaurantFoodBudget
  const restaurantDescription = formData.description.trim()
  const shoppingBudget = formData.shoppingItems.reduce((total, item) => total + item.price, 0)
  const shoppingDescription = formData.shoppingItems
    .map((item) => `${item.name} - ${formatNaira(item.price)}`)
    .join(', ')
  const waterBags = Number(formData.waterBags || 0)
  const numberOfPages = Number(formData.numberOfPages || 0)
  const printingLabel =
    formData.printingServiceType === 'photocopying' ? 'Photocopying' : 'Printing'
  const effectiveDescription =
    formData.taskType === 'restaurant'
      ? restaurantDescription
      : formData.taskType === 'shopping'
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
      : formData.taskType === 'shopping'
        ? shoppingBudget
        : formData.taskType === PRINTING_TASK_TYPE
          ? 0
        : parseMoneyInput(formData.amount || '')
  const description = effectiveDescription
  const taskType = formData.taskType || 'restaurant'
  const pricing = calculateOrderPricing({
    amount: Number.isFinite(amount) ? amount : 0,
    taskType,
    restaurantPeopleCount: normalizedRestaurantPeopleCount,
    waterBags: Number.isFinite(waterBags) ? waterBags : 0,
    noteSize: formData.noteSize,
    numberOfPages: Number.isFinite(numberOfPages) ? numberOfPages : 0,
    printingServiceType: formData.printingServiceType,
    printingNeedsEditing: formData.printingNeedsEditing === 'yes',
  })
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
  const deliveryStep = 3
  const reviewStep = 4
  const stepTitles = ['Choose Task', 'Details', 'Delivery', 'Review']
  const stepIcons = [ShoppingBag, FileText, MapPin, CreditCard]

  const clearError = useCallback((field: string) =>
    setErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    }), [])

  const transcribeOrderAudio = useCallback(
    async (audioBlob: Blob, mimeType: string) => {
      setIsTranscribingOrder(true)

      try {
        const form = new FormData()
        const extension = getAudioExtension(mimeType || audioBlob.type)
        form.append('file', audioBlob, `swiftdu-order.${extension}`)

        const response = await fetch('/api/stt/transcribe', {
          method: 'POST',
          body: form,
        })

        const data = (await response.json().catch(() => null)) as
          | { text?: string; detail?: string }
          | null

        if (!response.ok) {
          throw new Error(data?.detail || 'Transcription failed.')
        }

        const text = data?.text?.trim()

        if (!text) {
          throw new Error('No speech was detected.')
        }

        pauseRealtime()
        setFormData((previous) => ({
          ...previous,
          description: combineDescription(recordingBaseTextRef.current, text),
        }))
        clearError('description')
        toast.success('Speech captured')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Transcription failed.')
      } finally {
        setIsTranscribingOrder(false)
      }
    },
    [clearError, pauseRealtime]
  )

  const stopOrderRecording = useCallback(() => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }

    stopMediaRecorder(mediaRecorderRef.current)
  }, [])

  const startOrderRecording = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Speech recording is not supported on this browser.')
      return
    }

    if (typeof MediaRecorder === 'undefined') {
      toast.error('Speech recording is not supported on this browser.')
      return
    }

    pauseRealtime()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedAudioMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recordingBaseTextRef.current = formData.description

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        toast.error('Could not record audio. Please try again.')
      }

      recorder.onstop = () => {
        setIsRecordingOrder(false)
        mediaRecorderRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null

        const chunks = audioChunksRef.current
        audioChunksRef.current = []

        if (!chunks.length) {
          toast.error('No audio was captured.')
          return
        }

        const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        void transcribeOrderAudio(audioBlob, mimeType || 'audio/webm')
      }

      recorder.start()
      setIsRecordingOrder(true)
      toast.info('Recording...')

      recordingTimeoutRef.current = window.setTimeout(() => {
        stopOrderRecording()
      }, STT_MAX_RECORDING_MS)
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
      setIsRecordingOrder(false)

      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.error('Microphone permission denied')
        return
      }

      toast.error('Microphone unavailable')
    }
  }, [formData.description, pauseRealtime, stopOrderRecording, transcribeOrderAudio])

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    pauseRealtime()
    const { name, value } = event.target
    const nextValue =
      name === 'restaurantItemPrice' || name === 'shoppingItemPrice' || name === 'amount'
        ? formatMoneyInput(value)
        : value
    setFormData((previous) => ({ ...previous, [name]: nextValue }))
    clearError(name)
    if (
      name === 'restaurantItemPrice' ||
      name === 'restaurantPeople' ||
      name === 'shoppingItemName' ||
      name === 'shoppingItemPrice'
    ) {
      clearError('shoppingItems')
    }
  }

  const selectTaskType = (value: string) => {
    pauseRealtime()
    setFormData((previous) => ({
      ...previous,
      taskType: value,
      store: '',
      waterBags: value === WATER_TASK_TYPE ? previous.waterBags : '',
      noteSize: value === 'copy_notes' ? previous.noteSize : '',
      numberOfPages:
        value === 'copy_notes' || value === PRINTING_TASK_TYPE
          ? previous.numberOfPages
          : '',
      printingServiceType:
        value === PRINTING_TASK_TYPE ? previous.printingServiceType : '',
      printingNeedsEditing:
        value === PRINTING_TASK_TYPE ? previous.printingNeedsEditing : '',
      deadline: value === 'copy_notes' ? previous.deadline : '',
      packaging: value === 'restaurant' ? previous.packaging : '',
      amount:
        value === 'copy_notes' ||
        value === WATER_TASK_TYPE ||
        value === PRINTING_TASK_TYPE
          ? '0'
          : previous.amount,
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
    ].forEach(clearError)
    setStep(2)
    setErrors({})
  }

  const addShoppingItem = () => {
    pauseRealtime()
    const name = formData.shoppingItemName.trim()
    const price = parseMoneyInput(formData.shoppingItemPrice)

    if (!name || !Number.isFinite(price) || price <= 0) {
      setErrors((previous) => ({
        ...previous,
        shoppingItems: 'Enter the item name and a valid price.',
      }))
      return
    }

    setFormData((previous) => ({
      ...previous,
      shoppingItems: [
        ...previous.shoppingItems,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          price: Math.round(price),
        },
      ],
      shoppingItemName: '',
      shoppingItemPrice: '',
    }))
    clearError('shoppingItems')
    clearError('description')
    clearError('amount')
  }

  const removeShoppingItem = (id: string) => {
    pauseRealtime()
    setFormData((previous) => ({
      ...previous,
      shoppingItems: previous.shoppingItems.filter((item) => item.id !== id),
    }))
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
    formData.taskType !== WATER_TASK_TYPE &&
    !formData.store
  ) {
    nextErrors.store = 'Select the store for this task.'
  }

  if (formData.taskType === 'restaurant') {
    if (!restaurantDescription) {
      nextErrors.description = 'Describe what you want to order.'
    } else if (restaurantDescription.length < 5) {
      nextErrors.description = 'Use at least 5 characters.'
    }

    if (!Number.isFinite(restaurantFoodBudget) || restaurantFoodBudget <= 0) {
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

  if (formData.taskType === 'shopping' && formData.shoppingItems.length === 0) {
    nextErrors.shoppingItems = 'Add at least one item and price.'
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
    formData.taskType !== WATER_TASK_TYPE &&
    (formData.amount === '' || !Number.isFinite(amount) || amount < 0)
  ) {
    nextErrors.amount = 'Enter a valid item amount.'
  }
}

 if (stepNumber === deliveryStep) {
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
          restaurantPeopleCount:
            formData.taskType === 'restaurant'
              ? normalizedRestaurantPeopleCount
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
        taskType: '',
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
        restaurantItemPrice: '',
        restaurantPeople: '1',
        shoppingItems: [],
        shoppingItemName: '',
        shoppingItemPrice: '',
      })
      setStep(1)
      router.push('/dashboard/tasks')
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
  const showLowTaskerAvailabilityNotice = isLowTaskerAvailabilityWindow(currentTime)

  if (!mounted) return null

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
                  onClick={() => router.push(`/dashboard/tasks?orderId=${activeOrder._id}`)}
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
                    Open your {excoDashboard.excoRole} dashboard.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    Review the metrics and decision signals for the {excoDashboard.label} role.
                  </p>
                </div>
                <Button
                  onClick={() => router.push(excoDashboard.dashboardPath)}
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
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Add the store, item notes, and budget.</p>
                  </div>
                  {formData.taskType &&
                  formData.taskType !== 'others' &&
                  formData.taskType !== 'copy_notes' &&
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
                          Total is {formatNaira(pricing.totalAmount)}.
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
                              Service fee for this job is {formatNaira(pricing.serviceFee)}.
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
                          Total is {formatNaira(pricing.totalAmount)}.
                        </div>
                      ) : null}
                      {errors.waterBags ? <p className="mt-2 text-sm text-red-500">{errors.waterBags}</p> : null}
                    </div>
                  ) : null}
                  {formData.taskType === 'restaurant' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <ShoppingBag className="h-4 w-4 text-orange-500" />
                          Order description
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Describe what you want. Example: Rice and chicken, drink, snacks..."
                          rows={4}
                          className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Type manually or record your order and let SwiftDU fill it in.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isTranscribingOrder}
                          onClick={() => {
                            if (isRecordingOrder) {
                              stopOrderRecording()
                              return
                            }
                            void startOrderRecording()
                          }}
                          className={`mt-3 h-11 w-full rounded-xl border-2 border-orange-200 bg-orange-50 px-4 font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50 sm:w-auto ${
                            isRecordingOrder ? 'animate-pulse ring-4 ring-orange-500/15' : ''
                          }`}
                        >
                          {isTranscribingOrder ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Transcribing...
                            </>
                          ) : isRecordingOrder ? (
                            <>
                              <MicOff className="mr-2 h-4 w-4" />
                              Stop recording
                            </>
                          ) : (
                            <>
                              <Mic className="mr-2 h-4 w-4" />
                              Say your order
                            </>
                          )}
                        </Button>
                        {errors.description ? <p className="mt-2 text-sm text-red-500">{errors.description}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <ShoppingBag className="h-4 w-4 text-orange-500" />
                          Packaging
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {restaurantPackagingOptions.map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({ ...previous, packaging: option.value }))
                              }}
                              className={`h-12 rounded-xl border-2 px-3 text-sm font-bold transition ${
                                (formData.packaging || '') === option.value
                                  ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm dark:bg-orange-950/30 dark:text-orange-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-orange-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          If you choose takeaway, include that cost in your food budget.
                        </p>
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Wallet className="h-4 w-4 text-orange-500" />
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
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-9 font-mono text-lg outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          How much will the food cost?
                        </p>
                        <p className="mt-1 text-sm font-medium text-orange-700 dark:text-orange-300 pb-2">
                          Do not forget to calculate the takeaway amount for your budget.
                        </p>
                        {errors.restaurantItemPrice ? <p className="mt-2 text-sm text-red-500">{errors.restaurantItemPrice}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Wallet className="h-4 w-4 text-orange-500" />
                          Number of Orders
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: RESTAURANT_MAX_PEOPLE }, (_, index) => String(index + 1)).map((people) => (
                            <button
                              key={people}
                              type="button"
                              onClick={() => {
                                pauseRealtime()
                                setFormData((previous) => ({ ...previous, restaurantPeople: people }))
                                clearError('restaurantPeople')
                              }}
                              className={`h-12 rounded-xl border-2 text-sm font-bold transition ${
                                formData.restaurantPeople === people
                                  ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm dark:bg-orange-950/30 dark:text-orange-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-orange-700'
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
                      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100">
                        <span className="block pt-1 font-semibold">
                          If taskers notice the food is for multiple people, they can update your order price before you pay.
                        </span>
                        {shouldShowTieredServiceFee ? (
                          <span className="block pt-1 font-semibold">
                            Service fee for this budget is {formatNaira(pricing.serviceFee)}.
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
                          Store Items and Price
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                        <input
                          type="text"
                          name="shoppingItemName"
                          value={formData.shoppingItemName}
                          onChange={handleInputChange}
                          placeholder="Store item"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          name="shoppingItemPrice"
                          value={formData.shoppingItemPrice}
                          onChange={handleInputChange}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              addShoppingItem()
                            }
                          }}
                          placeholder="1,500"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 font-mono outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <Button
                          type="button"
                          onClick={addShoppingItem}
                          className="h-12 rounded-xl bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                        >
                          Add
                        </Button>
                      </div>
                      {formData.shoppingItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {formData.shoppingItems.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
                            >
                              <span className="truncate">{item.name}</span>
                              <span className="font-mono text-emerald-700 dark:text-emerald-200">
                                {formatNaira(item.price)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeShoppingItem(item.id)}
                                className="rounded-full p-0.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/50"
                                aria-label={`Remove ${item.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                        Item budget is {formatNaira(shoppingBudget)} before SwiftDU service fee.
                        {shouldShowTieredServiceFee ? (
                          <span className="block pt-1 font-semibold">
                            Service fee for this budget is {formatNaira(pricing.serviceFee)}.
                          </span>
                        ) : null}
                      </div>
                      {waterWarning ? (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                          Choose the bag of water task for water delivery.
                        </div>
                      ) : null}
                      {errors.shoppingItems ? <p className="mt-2 text-sm text-red-500">{errors.shoppingItems}</p> : null}
                    </div>
                  ) : null}
                  {formData.taskType !== WATER_TASK_TYPE && formData.taskType !== 'restaurant' && formData.taskType !== 'shopping' && formData.taskType !== PRINTING_TASK_TYPE ? (
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
                  {formData.taskType !== 'copy_notes' && formData.taskType !== 'restaurant' && formData.taskType !== 'shopping' && formData.taskType !== WATER_TASK_TYPE && formData.taskType !== PRINTING_TASK_TYPE ? (
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Wallet className="h-4 w-4 text-indigo-500" />Item Budget (NGN)</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                      <input type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="1,500" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-9 font-mono text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800" />
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">SwiftDU adds the delivery fee to the total you will later transfer to the tasker.</p>
                    {shouldShowTieredServiceFee ? (
                      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
                        Service fee for this budget is {formatNaira(pricing.serviceFee)}.
                      </div>
                    ) : null}
                    {errors.amount ? <p className="mt-2 text-sm text-red-500">{errors.amount}</p> : null}
                  </div>
                  ) : null}
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
                      {formData.taskType === 'shopping' && formData.shoppingItems.length > 0 ? (
                        <div className="flex justify-between gap-6">
                          <span className="text-slate-500">Store items</span>
                          <span className="flex max-w-[22rem] flex-wrap justify-end gap-2 text-right">
                            {formData.shoppingItems.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                              >
                                <span>{item.name}</span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-300">
                                  {formatNaira(item.price)}
                                </span>
                              </span>
                            ))}
                          </span>
                        </div>
                      ) : null}
                      {formData.taskType !== 'restaurant' && formData.taskType !== 'shopping' && formData.description ? <div className="flex justify-between gap-6"><span className="text-slate-500">Description</span><span className="max-w-[18rem] text-right text-slate-900 dark:text-slate-100">{formData.description}</span></div> : null}
                      <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Location</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.location}</span></div>
                      {formData.taskType === 'restaurant' ? <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">People</span><span className="text-right text-slate-900 dark:text-slate-100">{normalizedRestaurantPeopleCount}</span></div> : null}
                      {formData.taskType === 'restaurant' ? <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-slate-500">Packaging</span><span className="text-right text-slate-900 dark:text-slate-100">{formData.packaging || 'No takeaway pack'}</span></div> : null}
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
                      <div className="flex justify-between text-sm"><span className="text-slate-500">{pricing.pricingModel === 'copy_notes' ? 'Copy notes price' : pricing.pricingModel === 'water' ? 'Water budget + tasker fee' : formData.taskType === PRINTING_TASK_TYPE ? `${printingLabel} price` : formData.taskType === 'restaurant' ? 'Food budget' : formData.taskType === 'shopping' ? 'Store item budget' : 'Item budget'}</span><span className="font-medium">{formatNaira(pricing.amount)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500">{pricing.pricingModel === 'water' ? 'SwiftDU fee (24% of errand fee)' : pricing.pricingModel === 'copy_notes' ? 'SwiftDU fee' : 'Service fee'}</span><span className="font-medium">{formatNaira(pricing.serviceFee)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700"><span className="font-bold text-slate-900 dark:text-white">Total to pay</span><span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatNaira(pricing.totalAmount)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                    <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/70 dark:text-blue-300"><Info className="h-4 w-4" /></div>
                      <p>After a tasker accepts, the app moves you into a payment step where you see the tasker&apos;s bank details, make payment, and confirm it inside the tracker.</p>
                    </div>
                  </div>
                  {formData.taskType === 'restaurant' ? (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/70 dark:text-orange-300"><Info className="h-4 w-4" /></div>
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
