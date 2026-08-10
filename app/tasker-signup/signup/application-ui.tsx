'use client'

import type { CSSProperties, HTMLInputTypeAttribute } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, MailCheck } from 'lucide-react'

export type ChoiceOption = {
  value: string
  label: string
}

export function ApplicationProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: number
  totalSteps: number
}) {
  const progress = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="mb-5" aria-label={`Step ${currentStep + 1} of ${totalSteps}`}>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>Step {currentStep + 1} of {totalSteps}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
          style={{ width: `${progress}%` } as CSSProperties}
        />
      </div>
    </div>
  )
}

export function ApplicationStep({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

export function FormField({
  label,
  name,
  placeholder,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
}: {
  label: string
  name: string
  placeholder: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  hint?: string
  type?: HTMLInputTypeAttribute
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  maxLength?: number
}) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`

  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`min-h-13 w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-100'
        }`}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

export function SelectionCards({
  label,
  options,
  selected,
  onToggle,
  error,
  multiple = false,
}: {
  label: string
  options: ChoiceOption[]
  selected: string[]
  onToggle: (value: string) => void
  error?: string
  multiple?: boolean
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      {multiple && <p className="mt-1 text-xs text-slate-500">Choose all that apply.</p>}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(option.value)}
              className={`flex min-h-13 w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-blue-100 ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-[0_0_0_1px_rgba(37,99,235,0.1)]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center border text-white ${
                  multiple ? 'rounded-md' : 'rounded-full'
                } ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'}`}
              >
                {isSelected && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </fieldset>
  )
}

export function StepNavigation({
  currentStep,
  totalSteps,
  isSubmitting,
  onBack,
}: {
  currentStep: number
  totalSteps: number
  isSubmitting: boolean
  onBack: () => void
}) {
  const isFinalStep = currentStep === totalSteps - 1

  return (
    <div className="mt-7 flex items-center gap-3 border-t border-slate-100 pt-5">
      {currentStep > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-13 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm outline-none transition hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Submitting...
          </>
        ) : isFinalStep ? (
          'Submit Application'
        ) : (
          <>
            Continue
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </div>
  )
}

export function ApplicationSuccess({
  email,
  confirmationEmailSent,
  onHome,
}: {
  email: string
  confirmationEmailSent: boolean
  onHome: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f4f0] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <MailCheck className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-950">
          Application received <span aria-hidden="true">🎉</span>
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          We&rsquo;ll contact you on WhatsApp if you&rsquo;re selected for the next stage of
          SwiftDU Tasker training.
        </p>
        {confirmationEmailSent && (
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
            A confirmation was sent to {email}.
          </p>
        )}
        <button
          type="button"
          onClick={onHome}
          className="mt-6 min-h-13 w-full rounded-xl bg-slate-950 px-5 text-base font-bold text-white outline-none transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          Back to home
        </button>
      </section>
    </main>
  )
}
