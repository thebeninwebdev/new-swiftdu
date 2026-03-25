'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ErrandData {
  taskType: string
  description: string
  amount: string
  deadlineValue: string
  deadlineUnit: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  packaging?: string
}

export default function ErrandWizardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ErrandData>({
    taskType: '',
    description: '',
    amount: '',
    deadlineValue: '',
    deadlineUnit: 'hours',
    location: '',
    store: '',
    packaging: '',
  })

  const taskTypes = [
    { value: 'restaurant', label: 'Buy food from a restaurant' },
    { value: 'printing', label: 'Printing from cyber cafe' },
    { value: 'shopping', label: 'Buy items from a store' },
    { value: 'others', label: 'Small errands around campus' },
  ]

  const stores = [
    { value: '', label: 'Select a store...' },
    { value: 'akpan', label: 'Akpan' },
    { value: 'mama', label: 'Mama' },
    { value: 'golley', label: 'Golley' },
    { value: 'indomie', label: 'Indomie woman' },
  ]

  const packagingOptions = [
    { value: 'cellophane', label: 'Cellophane' },
    { value: 'takeaway', label: 'Take Away' },
  ]

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.taskType) {
      newErrors.taskType = 'Please select a task type'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/login')
        },
      },
    })
  }

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (formData.taskType !== 'others' && !formData.store) {
      newErrors.store = 'Please select a store'
    }

    if (formData.taskType === 'restaurant' && !formData.packaging) {
      newErrors.packaging = 'Please select a packaging option'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }

    if (!formData.amount) {
      newErrors.amount = 'Amount is required'
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.deadlineValue) {
      newErrors.deadlineValue = 'Deadline is required'
    } else if (parseInt(formData.deadlineValue) <= 0) {
      newErrors.deadlineValue = 'Deadline must be greater than 0'
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = (): void => {
    let isValid = false
    if (step === 1) isValid = validateStep1()
    else if (step === 2) isValid = validateStep2()
    else if (step === 3) isValid = validateStep3()

    if (isValid) {
      setStep(step + 1)
      setErrors({})
    }
  }

  const handleBack = (): void => {
    setStep(step - 1)
    setErrors({})
  }

  /**
   * Generates a unique Paystack payment reference.
   */
  const generateReference = (): string => {
    return `errand_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
  }

  /**
   * Creates the order in the backend after successful payment.
   */
  const createOrder = async (paymentReference: string): Promise<void> => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: formData.taskType,
          description: formData.description,
          amount: formData.amount,
          deadlineValue: formData.deadlineValue,
          deadlineUnit: formData.deadlineUnit,
          location: formData.location,
          store: formData.store || undefined,
          packaging: formData.packaging || undefined,
          paymentReference,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to submit errand')
        return
      }

      toast.success('Errand submitted and payment confirmed!')

      setFormData({
        taskType: '',
        description: '',
        amount: '',
        deadlineValue: '',
        deadlineUnit: 'hours',
        location: '',
        store: '',
        packaging: '',
      })
      setStep(1)

      router.push('/available-tasks')
    } catch (error) {
      console.error('[Errand Submit Error]:', error)
      toast.error('An error occurred while submitting your errand')
    } finally {
      setIsSubmitting(false)
    }
  }

const handleSubmit = async (): Promise<void> => {
  try {
    const session = await authClient.getSession()
    const userEmail = session?.data?.user?.email

    if (!userEmail) {
      toast.error('Could not retrieve your account email. Please log in again.')
      return
    }

    const amountInKobo = Math.round(Number(formData.amount) * 100)
    const reference = generateReference()

    // ✅ Dynamically import (fixes window error)
    const PaystackPop = (await import('@paystack/inline-js')).default

    const paystack = new PaystackPop()

    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: userEmail,
      amount: amountInKobo,
      currency: 'NGN',
      reference: reference,

      metadata: {
        custom_fields: [
          {
            display_name: "Task Type",
            variable_name: "task_type",
            value: formData.taskType,
          },
          {
            display_name: "Location",
            variable_name: "location",
            value: formData.location,
          },
        ],
      },

      onSuccess: async (transaction: { reference: string }) => {
        console.log('SUCCESS:', transaction)
        toast.success('Payment successful! Saving your errand...')
        await createOrder(transaction.reference)
      },

      onCancel: () => {
        toast.info('Payment cancelled')
      },
    })
  } catch (error) {
    console.error('Payment error:', error)
    toast.error('Failed to initialize payment')
  }
}

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 py-20 px-5">
      <Button onClick={signOut}>Sign out</Button>

      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {step} of 4</span>
          <span>{Math.round((step / 4) * 100)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Task Type */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">What is your errand?</h2>
            <p className="text-sm text-muted-foreground">
              Select the type of task you need help with
            </p>
          </div>
          <div className="space-y-3">
            {taskTypes.map((type) => (
              <label
                key={type.value}
                className="flex items-center gap-3 p-3 rounded-md border-2 cursor-pointer transition-all hover:bg-muted"
                style={{
                  borderColor:
                    formData.taskType === type.value
                      ? 'rgb(var(--color-primary) / 1)'
                      : 'rgb(var(--color-border) / 1)',
                  backgroundColor:
                    formData.taskType === type.value
                      ? 'rgb(var(--color-primary) / 0.05)'
                      : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="taskType"
                  value={type.value}
                  checked={formData.taskType === type.value}
                  onChange={handleInputChange}
                  className="cursor-pointer"
                />
                <span className="text-sm font-medium">{type.label}</span>
              </label>
            ))}
          </div>
          {errors.taskType && (
            <p className="text-sm text-destructive">{errors.taskType}</p>
          )}
        </div>
      )}

      {/* Step 2: Description & Amount */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Tell us the details</h2>
            <p className="text-sm text-muted-foreground">
              Provide a clear description and budget for your errand
            </p>
          </div>
          <div className="space-y-3">
            {formData.taskType !== 'others' && (
              <div>
                <label className="block text-sm font-medium mb-2">Store *</label>
                <select
                  name="store"
                  value={formData.store}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-md border-2 border-border outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
                >
                  {stores.map((store) => (
                    <option key={store.value} value={store.value}>
                      {store.label}
                    </option>
                  ))}
                </select>
                {errors.store && (
                  <p className="text-sm text-destructive mt-1">{errors.store}</p>
                )}
              </div>
            )}

            {formData.taskType === 'restaurant' && (
              <div>
                <label className="block text-sm font-medium mb-2">Packaging *</label>
                <select
                  name="packaging"
                  value={formData.packaging}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-md border-2 border-border outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
                >
                  <option value="">Select packaging option...</option>
                  {packagingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.packaging && (
                  <p className="text-sm text-destructive mt-1">{errors.packaging}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what you need in detail..."
                className="w-full px-3 py-2 rounded-md border-2 border-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 resize-none dark:bg-input/30 dark:border-input"
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">{errors.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Budget Amount (₦) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  ₦
                </span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-7 pr-3 py-2 rounded-md border-2 border-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-destructive mt-1">{errors.amount}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Deadline & Location */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">When and where?</h2>
            <p className="text-sm text-muted-foreground">
              Set a deadline and location for your errand
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Deadline *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="deadlineValue"
                  value={formData.deadlineValue}
                  onChange={handleInputChange}
                  placeholder="Enter time"
                  min="1"
                  className="flex-1 px-3 py-2 rounded-md border-2 border-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
                />
                <select
                  name="deadlineUnit"
                  value={formData.deadlineUnit}
                  onChange={handleInputChange}
                  className="px-3 py-2 rounded-md border-2 border-border outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
                >
                  <option value="mins">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              {errors.deadlineValue && (
                <p className="text-sm text-destructive mt-1">{errors.deadlineValue}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Library, Main Campus, Student Center"
                className="w-full px-3 py-2 rounded-md border-2 border-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
              />
              {errors.location && (
                <p className="text-sm text-destructive mt-1">{errors.location}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Review your errand</h2>
            <p className="text-sm text-muted-foreground">
              Make sure everything looks correct before paying
            </p>
          </div>
          <div className="space-y-3 rounded-md border-2 border-border p-4 dark:bg-input/30">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Task Type
              </p>
              <p className="text-sm font-medium mt-1">
                {taskTypes.find((t) => t.value === formData.taskType)?.label}
              </p>
            </div>

            {formData.taskType !== 'others' && formData.store && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Store
                </p>
                <p className="text-sm font-medium mt-1">
                  {stores.find((s) => s.value === formData.store)?.label}
                </p>
              </div>
            )}

            {formData.taskType === 'restaurant' && formData.packaging && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Packaging
                </p>
                <p className="text-sm font-medium mt-1">
                  {packagingOptions.find((p) => p.value === formData.packaging)?.label}
                </p>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Description
              </p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{formData.description}</p>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Budget
              </p>
              <p className="text-sm font-medium mt-1">
                ₦{parseFloat(formData.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Deadline
              </p>
              <p className="text-sm mt-1">
                {formData.deadlineValue} {formData.deadlineUnit}
              </p>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Location
              </p>
              <p className="text-sm mt-1">{formData.location}</p>
            </div>
          </div>

          {/* Payment notice */}
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span>🔒</span>
            <p>
              You will be charged{' '}
              <strong>
                ₦{parseFloat(formData.amount || '0').toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </strong>{' '}
              via Paystack. Payment is required to submit your errand.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1"
            disabled={isSubmitting}
          >
            Back
          </Button>
        )}
        {step < 4 && (
          <Button
            variant="default"
            onClick={handleNext}
            className="flex-1"
            disabled={isSubmitting}
          >
            Next
          </Button>
        )}
        {step === 4 && (
          <Button
            variant="default"
            onClick={handleSubmit}
            className="flex-1"
            disabled={isSubmitting}
          >
{isSubmitting
  ? 'Processing...'
  : `Pay ₦${parseFloat(formData.amount || '0').toLocaleString('en-NG')}`}
          </Button>
        )}
      </div>
    </div>
  )
}