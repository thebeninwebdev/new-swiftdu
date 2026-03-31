'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  MapPin, 
  Clock, 
  ShoppingBag, 
  FileText, 
  Store, 
  Package, 
  CreditCard,
  ArrowRight,
  Loader2,
} from 'lucide-react'

const SERVICE_CHARGE_PERCENTAGE = 15

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

const taskTypes = [
  { 
    value: 'restaurant', 
    label: 'Restaurant Food', 
    description: 'Get food delivered from campus restaurants',
    icon: '🍔',
    color: 'from-orange-400 to-red-500'
  },
  { 
    value: 'printing', 
    label: 'Printing Services', 
    description: 'Print documents from cyber cafes',
    icon: '🖨️',
    color: 'from-blue-400 to-indigo-500'
  },
  { 
    value: 'shopping', 
    label: 'Store Shopping', 
    description: 'Buy items from campus stores',
    icon: '🛍️',
    color: 'from-green-400 to-emerald-500'
  },
  { 
    value: 'others', 
    label: 'General Errands', 
    description: 'Any other tasks around campus',
    icon: '📋',
    color: 'from-purple-400 to-pink-500'
  },
]

const printingStores = [
  { value: '', label: 'Select a store...' },
  { value: 'teddy', label: 'Teddy Store' },
  { value: 'wdu', label: 'WDU Store' },
];

const shoppingStores = [
  { value: '', label: 'Select a store...' },
  { value: 'rita', label: 'Rita Store' },
  { value: 'sarah', label: 'Sarah Store' },
  { value: 'bright', label: 'Bright Store' },
];

const restaurantStores = [
  { value: '', label: 'Select a store...' },
  { value: 'akpan', label: 'Akpan Store' },
  { value: 'mama', label: 'Mama\'s Kitchen' },
  { value: 'golley', label: 'Golley Shop' },
  { value: 'indomie', label: 'Indomie Spot' },
];

const packagingOptions = [
  { value: 'cellophane', label: 'Cellophane Bag', price: 'Free' },
  { value: 'takeaway', label: 'Takeaway Pack', price: '₦200' },
]



export default function ErrandWizardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  
  const [formData, setFormData] = useState<ErrandData>({
    taskType: '',
    description: '',
    amount: '',
    deadlineValue: '',
    deadlineUnit: 'mins',
    location: '',
    store: '',
    packaging: '',
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculations
  const baseAmount = parseFloat(formData.amount || '0')
  const serviceCharge = baseAmount * (SERVICE_CHARGE_PERCENTAGE / 100)
  const totalAmount = baseAmount + serviceCharge

  const formatNaira = (value: number) => 
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value)

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (stepNum === 1) {
      if (!formData.taskType) newErrors.taskType = 'Select a task type to continue'
    }
    
    if (stepNum === 2) {
      if (formData.taskType !== 'others' && !formData.store) {
        newErrors.store = 'Please select a store'
      }
      if (formData.taskType === 'restaurant' && !formData.packaging) {
        newErrors.packaging = 'Select packaging preference'
      }
      if (!formData.description.trim()) {
        newErrors.description = 'Description is required'
      } else if (formData.description.trim().length < 10) {
        newErrors.description = 'Minimum 10 characters required'
      }
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        newErrors.amount = 'Enter a valid amount'
      }
    }
    
    if (stepNum === 3) {
      if (!formData.deadlineValue || parseInt(formData.deadlineValue) <= 0) {
        newErrors.deadlineValue = 'Set a valid deadline'
      }
      if (!formData.location.trim()) {
        newErrors.location = 'Delivery location required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setDirection(1)
      setStep(s => s + 1)
      setErrors({})
    }
  }

  const handleBack = () => {
    setDirection(-1)
    setStep(s => s - 1)
    setErrors({})
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }



  const generateReference = () => `errand_${Date.now()}_${Math.floor(Math.random() * 1000000)}`

  const createOrder = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to submit task')
        return
      }

      toast.success('Task posted successfully! Taskers will see your task soon.')
      setFormData({
        taskType: '', description: '', amount: '', deadlineValue: '',
        deadlineUnit: 'mins', location: '', store: '', packaging: '',
      })
      setStep(1)
      router.push('/dashboard/tasks')
    } catch (error) {
      toast.error('An error occurred while posting the task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(4)) return
    await createOrder()
  }

  const stepTitles = ['Choose Task', 'Details', 'Delivery', 'Review']
  const stepIcons = [ShoppingBag, FileText, MapPin, CreditCard]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">

      <div className="px-4 py-4 md:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-3xl">
            {/* Page Header */}
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Book a Task
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  Post a new errand and get help from verified runners
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex justify-between relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-linear-to-r from-indigo-500 to-purple-500 -translate-y-1/2 z-0 transition-all duration-500"
                  style={{ width: `${((step - 1) / 3) * 100}%` }}
                />
              
                {[1, 2, 3, 4].map((s, idx) => {
                  const Icon = stepIcons[idx]
                  const isActive = s === step
                  const isCompleted = s < step
                  
                  return (
                    <div key={s} className="relative z-10 flex flex-col items-center gap-2">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                          isCompleted 
                            ? 'bg-linear-to-r from-indigo-500 to-purple-500 border-transparent text-white' 
                            : isActive 
                              ? 'bg-white dark:bg-slate-900 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/25' 
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-medium transition-colors ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : 
                        isCompleted ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'
                      }`}>
                        {stepTitles[idx]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Main Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-white/50 dark:border-slate-800/50 overflow-hidden">
            
            {/* Step Content with Animation */}
            <div className="p-6 md:p-8 min-h-125 relative">
              <div 
                key={step}
                className="animate-in slide-in-from-right-8 fade-in duration-500"
              >
                {/* Step 1: Task Type */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        What do you need?
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400">
                        Select the category that best fits your errand
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {taskTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, taskType: type.value }))
                            if (errors.taskType) setErrors(prev => ({ ...prev, taskType: '' }))
                          }}
                          className={`group relative p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:scale-[1.02] ${
                            formData.taskType === type.value
                              ? 'border-indigo-500 bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 shadow-lg shadow-indigo-500/10'
                              : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg bg-white dark:bg-slate-800/50'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${type.color} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                            {type.icon}
                          </div>
                          <h3 className={`font-semibold mb-1 ${
                            formData.taskType === type.value ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-slate-100'
                          }`}>
                            {type.label}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {type.description}
                          </p>
                          
                          {formData.taskType === type.value && (
                            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {errors.taskType && (
                      <p className="text-center text-red-500 text-sm animate-pulse">{errors.taskType}</p>
                    )}
                  </div>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Errand Details
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400">
                        Provide specific information for your task
                      </p>
                    </div>

                    <div className="space-y-5">
                      {formData.taskType !== 'others' && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <Store className="w-4 h-4 text-indigo-500" />
                            Select Store *
                          </label>
                          <select
                            name="store"
                            value={formData.store}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none appearance-none cursor-pointer"
                          >
                            {(formData.taskType === 'printing' && printingStores.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))) ||
                            (formData.taskType === 'shopping' && shoppingStores.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))) ||
                            (formData.taskType === 'restaurant' && restaurantStores.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            )))}
                          </select>
                          {errors.store && <p className="text-red-500 text-sm">{errors.store}</p>}
                        </div>
                      )}

                      {formData.taskType === 'restaurant' && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <Package className="w-4 h-4 text-indigo-500" />
                            Packaging *
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {packagingOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setFormData(prev => ({ ...prev, packaging: option.value }))}
                                className={`p-4 rounded-xl border-2 text-center transition-all ${
                                  formData.packaging === option.value
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                }`}
                              >
                                <div className="font-medium">{option.label}</div>
                                <div className="text-sm text-slate-500">{option.price}</div>
                              </button>
                            ))}
                          </div>
                          {errors.packaging && <p className="text-red-500 text-sm">{errors.packaging}</p>}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <FileText className="w-4 h-4 text-indigo-500" />
                          Description *
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Describe exactly what you need..."
                          rows={4}
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none"
                        />
                        {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <CreditCard className="w-4 h-4 text-indigo-500" />
                          Budget (₦) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                          <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-mono text-lg"
                          />
                        </div>
                        {errors.amount && <p className="text-red-500 text-sm">{errors.amount}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Delivery */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Delivery Info
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400">
                        When and where should we deliver?
                      </p>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Clock className="w-4 h-4 text-indigo-500" />
                          Deadline *
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            name="deadlineValue"
                            value={formData.deadlineValue}
                            onChange={handleInputChange}
                            placeholder="Enter time"
                            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                          />
                          <select
                            name="deadlineUnit"
                            value={formData.deadlineUnit}
                            onChange={handleInputChange}
                            className="px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer min-w-30"
                          >
                            <option value="mins">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        {errors.deadlineValue && <p className="text-red-500 text-sm">{errors.deadlineValue}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                          Delivery Location *
                        </label>
                        <input
                          type="text"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          placeholder="e.g., Library 2nd Floor, Hall B Room 204..."
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        />
                        {errors.location && <p className="text-red-500 text-sm">{errors.location}</p>}
                      </div>

                      {/* Quick Location Suggestions */}
                      <div className="flex flex-wrap gap-2">
                        {['Library', 'Student Center', 'Main Gate', 'Hall A', 'Cafeteria'].map(loc => (
                          <button
                            key={loc}
                            onClick={() => setFormData(prev => ({ ...prev, location: loc }))}
                            className="px-3 py-1.5 rounded-full text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Review */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Review Your Task
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400">
                        Double-check all details before posting
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-4 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-linear-to-br ${taskTypes.find(t => t.value === formData.taskType)?.color} flex items-center justify-center text-lg`}>
                            {taskTypes.find(t => t.value === formData.taskType)?.icon}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {taskTypes.find(t => t.value === formData.taskType)?.label}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formData.store && (
                                (formData.taskType === 'printing' && printingStores.find(s => s.value === formData.store)?.label) ||
                                (formData.taskType === 'shopping' && shoppingStores.find(s => s.value === formData.store)?.label) ||
                                (formData.taskType === 'restaurant' && restaurantStores.find(s => s.value === formData.store)?.label)
                              )}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setStep(1)} className="text-indigo-500 hover:text-indigo-600 text-sm font-medium">
                          Edit
                        </button>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Description</span>
                          <span className="text-slate-900 dark:text-slate-100 max-w-50 text-right">
                            {formData.description}
                          </span>
                        </div>
                        
                        <div className="flex justify-between py-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500">Location</span>
                          <span className="text-slate-900 dark:text-slate-100">{formData.location}</span>
                        </div>
                        
                        <div className="flex justify-between py-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500">Deadline</span>
                          <span className="text-slate-900 dark:text-slate-100">
                            {formData.deadlineValue} {formData.deadlineUnit}
                          </span>
                        </div>

                        {formData.packaging && (
                          <div className="flex justify-between py-2 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500">Packaging</span>
                            <span className="text-slate-900 dark:text-slate-100">
                              {packagingOptions.find(p => p.value === formData.packaging)?.label}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-6 border-t-2 border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Budget</span>
                          <span className="font-medium">{formatNaira(baseAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Commission ({SERVICE_CHARGE_PERCENTAGE}%)</span>
                          <span className="font-medium">{formatNaira(serviceCharge)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                          <span className="font-bold text-slate-900 dark:text-white">Total Amount</span>
                          <span className="font-bold text-xl text-indigo-600 dark:text-indigo-400">
                            {formatNaira(totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</span>
                      </div>
                      <div className="text-sm text-blue-900 dark:text-blue-200">
                        <p className="font-medium mb-1">Payment After Acceptance</p>
                        <p>Once a tasker accepts your task, you&apos;ll receive their bank details to transfer the amount {formatNaira(totalAmount)}. No upfront payment required.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="px-6 md:px-8 pb-6 md:pb-8 pt-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
              <div className="flex gap-3">
                {step > 1 && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    className="flex-1 h-12 rounded-xl border-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                
                {step < 4 ? (
                  <Button
                    onClick={handleNext}
                    className="flex-1 h-12 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 h-12 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        Post Task
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-8 flex justify-center items-center gap-6 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Direct Transfers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Verified Taskers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
