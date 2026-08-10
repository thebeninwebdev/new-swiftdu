'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import {
  ApplicationProgress,
  ApplicationStep,
  ApplicationSuccess,
  FormField,
  ReadOnlyField,
  SelectionCards,
  StepNavigation,
  type ChoiceOption,
} from './application-ui'

interface FormData {
  firstName: string
  lastName: string
  email: string
  location: string
  locationOther: string
  phoneNumber: string
  studentId: string
  level: string
  availability: string[]
  motivation: string
  motivationOther: string
}

interface SessionUser {
  name: string
  email: string
  phone?: string | null
  location?: string | null
}

const STEP_TITLES = ['About You', 'Availability', 'Final Questions']

const LOCATION_OPTIONS: ChoiceOption[] = [
  { value: 'Amnesty', label: 'Amnesty' },
  { value: 'Girls Hostel', label: 'Girls Hostel' },
  { value: 'Law Hall', label: 'Law Hall' },
  { value: 'Staff Quarters', label: 'Staff Quarters' },
  { value: 'Off campus', label: 'Outside school' },
  { value: 'Other', label: 'Somewhere else' },
]

const LEVEL_OPTIONS: ChoiceOption[] = [
  { value: '100 Level', label: '100L' },
  { value: '200 Level', label: '200L' },
  { value: '300 Level', label: '300L' },
  { value: '400 Level', label: '400L' },
  { value: '500 Level', label: '500L' },
  { value: '600 Level', label: '600L' },
]

const AVAILABILITY_OPTIONS: ChoiceOption[] = [
  { value: 'Morning', label: 'Morning' },
  { value: 'Afternoons', label: 'Afternoons' },
  { value: 'Evenings', label: 'Evenings' },
]

const MOTIVATION_OPTIONS: ChoiceOption[] = [
  { value: 'Make money', label: 'Make money' },
  { value: 'Gain work experience', label: 'Gain experience' },
  { value: 'Help other students', label: 'Help students' },
  { value: 'Other', label: 'Something else' },
]

const INITIAL_FORM: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  location: '',
  locationOther: '',
  phoneNumber: '',
  studentId: '',
  level: '',
  availability: [],
  motivation: '',
  motivationOther: '',
}

export default function TaskerSignupPage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false)
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadOptionalSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (!data?.user) return

        const sessionUser = data.user as SessionUser
        const savedLocation = sessionUser.location?.trim() || ''
        const listedLocation = LOCATION_OPTIONS.some(({ value }) => value === savedLocation)
        const [firstName = '', ...lastNameParts] = (sessionUser.name || '').trim().split(/\s+/)

        setUser(sessionUser)
        setFormData((current) => ({
          ...current,
          firstName,
          lastName: lastNameParts.join(' '),
          email: sessionUser.email || '',
          phoneNumber: sessionUser.phone || '',
          location: savedLocation ? (listedLocation ? savedLocation : 'Other') : '',
          locationOther: savedLocation && !listedLocation ? savedLocation : '',
        }))
      } catch {
        // A session is optional for this public application.
      } finally {
        setIsLoading(false)
      }
    }

    void loadOptionalSession()
  }, [])

  const selectedLocation =
    formData.location === 'Other' ? formData.locationOther.trim() : formData.location

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }))
  }

  const selectChoice = (name: keyof FormData, value: string) => {
    setFormData((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const toggleAvailability = (value: string) => {
    setFormData((current) => ({
      ...current,
      availability: current.availability.includes(value)
        ? current.availability.filter((item) => item !== value)
        : [...current.availability, value],
    }))
    setErrors((current) => ({ ...current, availability: '' }))
  }

  const validateStep = () => {
    const nextErrors: Record<string, string> = {}

    if (currentStep === 0) {
      if (!(formData.firstName ?? '').trim()) nextErrors.firstName = 'Enter your first name.'
      if (!(formData.lastName ?? '').trim()) nextErrors.lastName = 'Enter your last name.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        nextErrors.email = 'Enter a valid email.'
      }
      if (!/^(\+234|0)[789][01]\d{8}$/.test(formData.phoneNumber)) {
        nextErrors.phoneNumber = 'Enter a valid WhatsApp number.'
      }
      if (!formData.studentId.trim()) nextErrors.studentId = 'Enter your matric number.'
      if (!formData.level) nextErrors.level = 'Choose your level.'
    }

    if (currentStep === 1) {
      if (!selectedLocation) {
        if (formData.location === 'Other') {
          nextErrors.locationOther = 'Tell us where you stay.'
        } else {
          nextErrors.location = 'Choose where you stay.'
        }
      }
      if (formData.availability.length === 0) {
        nextErrors.availability = 'Choose when you can work.'
      }
    }

    if (currentStep === 2) {
      if (!formData.motivation) nextErrors.motivation = 'Choose your main reason.'
      if (formData.motivation === 'Other' && !formData.motivationOther.trim()) {
        nextErrors.motivationOther = 'Tell us your reason.'
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep()) return
    setErrors({})
    setCurrentStep((step) => Math.min(step + 1, STEP_TITLES.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setErrors({})
    setCurrentStep((step) => Math.max(step - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateStep()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/taskers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: (formData.firstName ?? '').trim(),
          lastName: (formData.lastName ?? '').trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phoneNumber,
          location: selectedLocation,
          studentId: formData.studentId,
          level: formData.level,
          availability: formData.availability,
          motivation: formData.motivation,
          motivationOther:
            formData.motivation === 'Other' ? formData.motivationOther.trim() : '',
        }),
      })

      let data
      try {
        data = await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        toast.error(data.error || 'We could not submit your application. Please try again.')
        return
      }

      setConfirmationEmailSent(Boolean(data.confirmationEmailSent))
      if (!data.confirmationEmailSent) {
        toast.warning('Application submitted, but the confirmation email could not be sent.')
      }
      setSubmitted(true)
    } catch {
      toast.error('Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f5f4f0] text-slate-500">
        <Loader2 className="size-7 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Getting your form ready...</p>
      </main>
    )
  }

  if (submitted) {
    return (
      <ApplicationSuccess
        email={formData.email.trim().toLowerCase()}
        confirmationEmailSent={confirmationEmailSent}
        onHome={() => router.push('/')}
      />
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f4f0] px-3 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-5 px-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            Join the SwiftDU community
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Become a SwiftDU Tasker
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Three quick steps. Tap your answers and send your application.
          </p>
        </header>

        <ApplicationProgress currentStep={currentStep} totalSteps={STEP_TITLES.length} />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
          <form
            noValidate
            onSubmit={
              currentStep === STEP_TITLES.length - 1
                ? handleSubmit
                : (event) => {
                    event.preventDefault()
                    handleNext()
                  }
            }
          >
            {currentStep === 0 && (
              <ApplicationStep title="About you" description="Your basic contact and school details.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="First name"
                    name="firstName"
                    placeholder="Your first name"
                    value={formData.firstName ?? ''}
                    onChange={handleInputChange}
                    error={errors.firstName}
                    autoComplete="given-name"
                  />
                  <FormField
                    label="Last name"
                    name="lastName"
                    placeholder="Your last name"
                    value={formData.lastName ?? ''}
                    onChange={handleInputChange}
                    error={errors.lastName}
                    autoComplete="family-name"
                  />
                </div>
                {user ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <ReadOnlyField label="Email" value={formData.email} />
                  </div>
                ) : (
                  <>
                    <FormField
                      label="Email address"
                      name="email"
                      type="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      error={errors.email}
                      autoComplete="email"
                    />
                  </>
                )}
                <FormField
                  label="WhatsApp number"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  placeholder="08012345678"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  error={errors.phoneNumber}
                  hint="Use the number you check most often."
                  autoComplete="tel"
                />
                <FormField
                  label="Matric number"
                  name="studentId"
                  placeholder="CST/2021/001"
                  value={formData.studentId}
                  onChange={handleInputChange}
                  error={errors.studentId}
                />
                <SelectionCards
                  label="What level are you?"
                  options={LEVEL_OPTIONS}
                  selected={[formData.level]}
                  onToggle={(value) => selectChoice('level', value)}
                  error={errors.level}
                />
              </ApplicationStep>
            )}

            {currentStep === 1 && (
              <ApplicationStep title="Availability" description="Tell us where and when you can work.">
                <SelectionCards
                  label="Where do you stay?"
                  options={LOCATION_OPTIONS}
                  selected={[formData.location]}
                  onToggle={(value) => selectChoice('location', value)}
                  error={errors.location}
                />
                {formData.location === 'Other' && (
                  <FormField
                    label="Where do you stay?"
                    name="locationOther"
                    placeholder="Type your location"
                    value={formData.locationOther}
                    onChange={handleInputChange}
                    error={errors.locationOther}
                  />
                )}
                <SelectionCards
                  label="When can you usually work?"
                  options={AVAILABILITY_OPTIONS}
                  selected={formData.availability}
                  onToggle={toggleAvailability}
                  error={errors.availability}
                  multiple
                />
              </ApplicationStep>
            )}

            {currentStep === 2 && (
              <ApplicationStep title="Final questions" description="One last step before you submit.">
                <SelectionCards
                  label="Why do you want to become a Tasker?"
                  options={MOTIVATION_OPTIONS}
                  selected={[formData.motivation]}
                  onToggle={(value) => selectChoice('motivation', value)}
                  error={errors.motivation}
                />
                {formData.motivation === 'Other' && (
                  <FormField
                    label="Tell us your reason"
                    name="motivationOther"
                    placeholder="A short reason"
                    value={formData.motivationOther}
                    onChange={handleInputChange}
                    error={errors.motivationOther}
                  />
                )}

              </ApplicationStep>
            )}

            <StepNavigation
              currentStep={currentStep}
              totalSteps={STEP_TITLES.length}
              isSubmitting={isSubmitting}
              onBack={handleBack}
            />
          </form>
        </div>

        <p className="px-4 pt-4 text-center text-xs leading-5 text-slate-400">
          Your details are used only to review your Tasker application.
        </p>
      </div>
    </main>
  )
}
