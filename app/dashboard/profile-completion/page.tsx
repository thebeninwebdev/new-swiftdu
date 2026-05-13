"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  PROFILE_COMPLETION_FIELDS,
  type ProfileCompletionField,
  type getProfileCompletion,
} from "@/lib/profile-completion"

type ProfileCompletion = ReturnType<typeof getProfileCompletion>

type ProfileForm = {
  id: string
  name: string
  email: string
  phone: string
  location: string
  profileImage: string
  profileImagePublicId: string
  gender: string
  dateOfBirth: string
}

type ProfileResponse = {
  user: ProfileForm
  completion: ProfileCompletion
}

const genderLabels: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
}

const fieldHelp: Record<ProfileCompletionField, string> = {
  profileImage: "Add a clear profile picture.",
  name: "Your full name as other users should see it.",
  email: "Your verified account email.",
  phone: "A phone number support can use if needed.",
  location: "Your hostel or usual campus location.",
  gender: "Choose the option that fits you.",
  dateOfBirth: "This helps us keep account records accurate.",
}

function getFieldValue(form: ProfileForm, field: ProfileCompletionField) {
  if (field === "gender") return genderLabels[form.gender] || form.gender
  if (field === "profileImage") return form.profileImage ? "Profile picture uploaded" : ""
  if (field === "dateOfBirth" && form.dateOfBirth) {
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
    }).format(new Date(`${form.dateOfBirth}T00:00:00.000Z`))
  }

  return form[field]
}

export default function ProfileCompletionPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [savingField, setSavingField] = useState<ProfileCompletionField | null>(
    null
  )
  const [pageError, setPageError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const completedFields = useMemo(
    () =>
      new Set(
        completion
          ? PROFILE_COMPLETION_FIELDS.filter(
              (item) =>
                !completion.missingFields.some(
                  (missing) => missing.field === item.field
                )
            ).map((item) => item.field)
          : []
      ),
    [completion]
  )

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/users/me/profile", {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load profile.")
        }

        const payload = (await response.json()) as ProfileResponse
        setForm(payload.user)
        setCompletion(payload.completion)
      } catch (error) {
        setPageError(
          error instanceof Error ? error.message : "Failed to load profile."
        )
      }
    }

    void loadProfile()
  }, [])

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setImageFile(file)
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.profileImage
      return next
    })
  }

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("")
      return
    }

    const nextPreview = URL.createObjectURL(imageFile)
    setImagePreview(nextPreview)

    return () => URL.revokeObjectURL(nextPreview)
  }, [imageFile])

  const uploadToCloudinary = async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

    if (!cloudName) {
      throw new Error("Image uploads are not configured.")
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("Please select a valid image file.")
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image must be under 5MB.")
    }

    const body = new FormData()
    body.append("file", file)
    body.append(
      "upload_preset",
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "tasker_profiles"
    )

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body }
    )

    if (!response.ok) {
      throw new Error("Image upload failed.")
    }

    const data = await response.json()

    return {
      profileImage: data.secure_url as string,
      profileImagePublicId: data.public_id as string,
    }
  }

  const buildPayload = async (field: ProfileCompletionField) => {
    if (!form) return null

    if (field === "profileImage") {
      if (!imageFile) return null
      return uploadToCloudinary(imageFile)
    }

    const value = form[field]
    if (typeof value !== "string" || !value.trim()) return null

    if (field === "dateOfBirth") {
      const date = new Date(`${value}T00:00:00.000Z`)

      if (Number.isNaN(date.getTime()) || date > new Date()) {
        throw new Error("Enter a valid date of birth.")
      }
    }

    return { [field]: value }
  }

  const saveField = async (field: ProfileCompletionField) => {
    setSavingField(field)
    setPageError("")

    try {
      const payload = await buildPayload(field)

      if (!payload) {
        toast.message("Nothing to save yet.")
        return
      }

      const response = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as
        | ProfileResponse
        | { error?: string }

      if (!response.ok || !("completion" in data)) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Failed to save profile."
        )
      }

      setForm(data.user)
      setCompletion(data.completion)
      if (field === "profileImage") setImageFile(null)
      window.dispatchEvent(new Event("swiftdu-profile-updated"))
      toast.success("Profile updated")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save profile."
      setFieldErrors((prev) => ({ ...prev, [field]: message }))
      toast.error(message)
    } finally {
      setSavingField(null)
    }
  }

  const renderFieldInput = (field: ProfileCompletionField) => {
    if (!form) return null

    if (field === "profileImage") {
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-full border bg-slate-100 dark:bg-slate-900">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt="Selected profile"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <ImagePlus className="h-7 w-7 text-slate-400" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={savingField === field}
            >
              Choose photo
            </Button>
            <span className="max-w-full truncate text-sm text-muted-foreground">
              {imageFile?.name || "No photo selected"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              disabled={savingField === field}
            />
          </div>
        </div>
      )
    }

    if (field === "gender") {
      return (
        <select
          name="gender"
          value={form.gender}
          onChange={handleInputChange}
          disabled={savingField === field}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      )
    }

    if (field === "email") {
      return (
        <Input value={form.email} disabled placeholder="Email address" />
      )
    }

    return (
      <Input
        name={field}
        type={field === "dateOfBirth" ? "date" : "text"}
        value={form[field]}
        onChange={handleInputChange}
        disabled={savingField === field}
      />
    )
  }

  if (pageError && !form) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {pageError}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/dashboard/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to account
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
            Complete your profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Completed details are checked off. You can save one missing detail at
            a time.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4">
              <span>Account details</span>
              <span className="text-2xl font-bold text-indigo-600">
                {completion?.percentage ?? 0}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!form || !completion ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profile...
              </div>
            ) : (
              PROFILE_COMPLETION_FIELDS.map(({ field, label }) => {
                const isComplete = completedFields.has(field)
                const displayValue = getFieldValue(form, field)

                return (
                  <div
                    key={field}
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isComplete
                                ? "flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white"
                                : "size-5 rounded-full border border-slate-300"
                            }
                          >
                            {isComplete ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : null}
                          </span>
                          <h2
                            className={
                              isComplete
                                ? "font-semibold text-muted-foreground line-through"
                                : "font-semibold text-foreground"
                            }
                          >
                            {label}
                          </h2>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isComplete && displayValue
                            ? String(displayValue)
                            : fieldHelp[field]}
                        </p>
                      </div>
                    </div>

                    {!isComplete && (
                      <div className="mt-4 space-y-3">
                        {renderFieldInput(field)}
                        {fieldErrors[field] && (
                          <p className="text-sm font-medium text-destructive">
                            {fieldErrors[field]}
                          </p>
                        )}
                        {field === "email" ? (
                          <p className="text-sm text-muted-foreground">
                            Email is set during signup. Contact support if this
                            is missing.
                          </p>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => saveField(field)}
                            disabled={savingField === field}
                          >
                            {savingField === field ? "Saving..." : "Save"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
