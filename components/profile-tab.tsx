"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { createAvatar } from "@dicebear/core"
import * as adventurerNeutral from "@dicebear/adventurer-neutral"
import {
  Camera,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Fingerprint,
  Shield,
  Pencil,
  X,
  Check,
  Sparkles,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type Gender = "" | "male" | "female" | "other" | "prefer_not_to_say"

interface ProfileForm {
  name: string
  email: string
  phone: string
  location: string
  profileImage: string
  profileImagePublicId: string
  gender: Gender
  dateOfBirth: string
}

interface ProfileResponse {
  user: ProfileForm & { id: string }
}

interface CloudinaryResult {
  secure_url: string
  public_id: string
}

interface PasskeySummary {
  id: string
  name?: string
  createdAt?: string | Date
}

const EMPTY_FORM: ProfileForm = {
  name: "",
  email: "",
  phone: "",
  location: "",
  profileImage: "",
  profileImagePublicId: "",
  gender: "",
  dateOfBirth: "",
}

const genderLabels: Record<Exclude<Gender, "">, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
}

const fieldIcons: Record<string, React.ReactNode> = {
  name: <User className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  gender: <User className="h-4 w-4" />,
  dateOfBirth: <Calendar className="h-4 w-4" />,
}

function displayValue(value?: string | null) {
  return value?.trim() || "Not set"
}

function formatDate(value?: string) {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00.000Z`)
  )
}

export function ProfileTab() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(true)
  const [isPasskeySaving, setIsPasskeySaving] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([])
  const [formData, setFormData] = useState<ProfileForm>(EMPTY_FORM)
  const [savedFormData, setSavedFormData] = useState<ProfileForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isVisible, setIsVisible] = useState(false)

  const fallbackAvatar = useMemo(
    () =>
      createAvatar(adventurerNeutral, {
        seed: [formData.email, formData.name].filter(Boolean).join(":") || "swiftdu-user",
        size: 160,
        radius: 50,
        backgroundColor: ["e0f2fe", "eef2ff", "ecfeff"],
        backgroundType: ["gradientLinear"],
      }).toDataUri(),
    [formData.email, formData.name]
  )
  const avatarSrc = formData.profileImage || fallbackAvatar

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true)
      try {
        const response = await fetch("/api/users/me/profile", { cache: "no-store" })
        if (!response.ok) throw new Error("Failed to load profile")
        const payload = (await response.json()) as ProfileResponse
        const nextForm = {
          ...EMPTY_FORM,
          ...payload.user,
          gender: (payload.user.gender || "") as Gender,
        }
        setFormData(nextForm)
        setSavedFormData(nextForm)
        setTimeout(() => setIsVisible(true), 100)
      } catch {
        toast.error("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }
    void loadProfile()
  }, [])

  const loadPasskeys = async () => {
    setIsPasskeyLoading(true)
    try {
      const response = await fetch("/api/auth/passkey/list-user-passkeys", {
        cache: "no-store",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to load passkeys")
      const data = (await response.json()) as PasskeySummary[]
      setPasskeys(Array.isArray(data) ? data : [])
    } catch {
      setPasskeys([])
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  useEffect(() => {
    void loadPasskeys()
  }, [])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = "Name is required"
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }
    if (formData.dateOfBirth) {
      const date = new Date(`${formData.dateOfBirth}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime()) || date > new Date()) {
        newErrors.dateOfBirth = "Enter a valid date of birth"
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const saveProfile = async (payload: Partial<ProfileForm>) => {
    const response = await fetch("/api/users/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Failed to save profile")
    const nextForm = {
      ...EMPTY_FORM,
      ...data.user,
      gender: (data.user.gender || "") as Gender,
    }
    setFormData(nextForm)
    setSavedFormData(nextForm)
    window.dispatchEvent(new Event("swiftdu-profile-updated"))
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setIsSaving(true)
    try {
      await saveProfile({
        name: formData.name,
        phone: formData.phone,
        location: formData.location,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
      })
      setIsEditing(false)
      toast.success("Profile updated successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData(savedFormData)
    setIsEditing(false)
    setErrors({})
  }

  const uploadToCloudinary = async (file: File): Promise<CloudinaryResult> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) throw new Error("Image uploads are not configured.")
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
    if (!response.ok) throw new Error("Image upload failed.")
    const data = await response.json()
    return { secure_url: data.secure_url, public_id: data.public_id }
  }

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB")
      return
    }
    setIsUploadingImage(true)
    try {
      const upload = await uploadToCloudinary(file)
      await saveProfile({
        profileImage: upload.secure_url,
        profileImagePublicId: upload.public_id,
      })
      toast.success("Profile picture updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleEnablePasskey = async () => {
    if (!window.PublicKeyCredential) {
      toast.error("This device does not support biometric passkeys.")
      return
    }
    setIsPasskeySaving(true)
    try {
      const { error } = await authClient.passkey.addPasskey({
        name: "Fingerprint / Face ID",
        authenticatorAttachment: "platform",
      })
      if (error) throw new Error(error.message || "Could not enable biometric sign-in")
      toast.success("Fingerprint / Face ID sign-in enabled")
      await loadPasskeys()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not enable biometric sign-in"
      )
    } finally {
      setIsPasskeySaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-indigo-500/10" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mx-auto max-w-3xl space-y-6 transition-all duration-700 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg outline-none ring-1 ring-slate-200 transition hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-900 dark:bg-slate-800 dark:ring-slate-700"
          aria-label="Upload profile picture"
        >
          <Image
            src={avatarSrc}
            alt="Profile picture"
            width={112}
            height={112}
            unoptimized
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            {isUploadingImage ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </span>
          {formData.profileImage && (
            <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white">
              <Check className="h-4 w-4" />
            </span>
          )}
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {formData.name || "Your Profile"}
          </p>
          <p className="text-sm text-muted-foreground">{formData.email}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
          disabled={isUploadingImage}
        />
      </div>

      {/* Main Info Card */}
      <Card className="border-slate-200/60 shadow-lg dark:border-slate-800/60 dark:bg-slate-950/50">
        <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-indigo-500" />
                Personal Information
              </CardTitle>
              <CardDescription>Manage your profile details</CardDescription>
            </div>
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="gap-2 transition-all hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { key: "name", label: "Full Name", type: "text", placeholder: "Enter your full name" },
              { key: "email", label: "Email Address", type: "email", placeholder: "Enter your email", disabled: true },
              { key: "phone", label: "Phone Number", type: "tel", placeholder: "Enter your phone number" },
              { key: "location", label: "Location", type: "text", placeholder: "Enter your location" },
            ].map((field, index) => (
              <div
                key={field.key}
                className={cn(
                  "group transition-all duration-500",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                )}
                style={{ transitionDelay: `${index * 75 + 200}ms` }}
              >
                <Field>
                  <FieldLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {fieldIcons[field.key]}
                    {field.label}
                  </FieldLabel>
                  {isEditing ? (
                    <div className="relative">
                      <Input
                        name={field.key}
                        type={field.type}
                        value={formData[field.key as keyof ProfileForm] as string}
                        onChange={handleInputChange}
                        placeholder={field.placeholder}
                        disabled={isSaving || field.disabled}
                        className={cn(
                          "mt-1.5 transition-all focus-visible:ring-indigo-500/50",
                          field.disabled && "bg-slate-100 dark:bg-slate-900"
                        )}
                      />
                      {field.disabled && (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Contact support to change your email
                        </p>
                      )}
                      {errors[field.key] && (
                        <FieldError className="mt-1.5 animate-in slide-in-from-top-1">
                          {errors[field.key]}
                        </FieldError>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 transition-colors group-hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-100 dark:group-hover:bg-slate-800/80">
                      <span className="flex-1">
                        {displayValue(formData[field.key as keyof ProfileForm] as string)}
                      </span>
                      {!formData[field.key as keyof ProfileForm] && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          Missing
                        </span>
                      )}
                    </div>
                  )}
                </Field>
              </div>
            ))}

            {/* Gender */}
            <div
              className={cn(
                "transition-all duration-500",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: "500ms" }}
            >
              <Field>
                <FieldLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <User className="h-4 w-4" />
                  Gender
                </FieldLabel>
                {isEditing ? (
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    disabled={isSaving}
                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                ) : (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800/80">
                    <span className="flex-1">
                      {formData.gender ? genderLabels[formData.gender] : "Not set"}
                    </span>
                    {!formData.gender && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Missing
                      </span>
                    )}
                  </div>
                )}
              </Field>
            </div>

            {/* Date of Birth */}
            <div
              className={cn(
                "transition-all duration-500",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: "575ms" }}
            >
              <Field>
                <FieldLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Calendar className="h-4 w-4" />
                  Date of Birth
                </FieldLabel>
                {isEditing ? (
                  <div className="relative">
                    <Input
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      disabled={isSaving}
                      className="mt-1.5 transition-all focus-visible:ring-indigo-500/50"
                    />
                    {errors.dateOfBirth && (
                      <FieldError className="mt-1.5 animate-in slide-in-from-top-1">
                        {errors.dateOfBirth}
                      </FieldError>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800/80">
                    <span className="flex-1">{formatDate(formData.dateOfBirth)}</span>
                    {!formData.dateOfBirth && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Missing
                      </span>
                    )}
                  </div>
                )}
              </Field>
            </div>
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="mt-8 flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={isSaving}
                className="flex-1 gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security / Passkey Card */}
      <Card
        className={cn(
          "overflow-hidden border-slate-200/60 shadow-lg transition-all duration-700 dark:border-slate-800/60 dark:bg-slate-950/50",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}
        style={{ transitionDelay: "300ms" }}
      >
        <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-emerald-500" />
            Security
          </CardTitle>
          <CardDescription>Manage your authentication methods</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border transition-all duration-500",
              passkeys.length > 0
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-teal-950/20"
                : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40"
            )}
          >
            <div className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                      passkeys.length > 0
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {passkeys.length > 0 ? (
                      <Fingerprint className="h-6 w-6" />
                    ) : (
                      <KeyRound className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Biometric Authentication</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {isPasskeyLoading
                        ? "Checking status..."
                        : passkeys.length > 0
                          ? `${passkeys.length} device${passkeys.length > 1 ? "s" : ""} registered`
                          : "Use your fingerprint or Face ID to sign in"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={passkeys.length > 0 ? "outline" : "default"}
                  onClick={handleEnablePasskey}
                  disabled={isPasskeyLoading || isPasskeySaving}
                  className={cn(
                    "shrink-0 gap-2 transition-all",
                    passkeys.length === 0 &&
                      "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  )}
                >
                  {isPasskeySaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : passkeys.length > 0 ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Fingerprint className="h-4 w-4" />
                  )}
                  {isPasskeySaving
                    ? "Enabling..."
                    : passkeys.length > 0
                      ? "Add Device"
                      : "Enable"}
                </Button>
              </div>

              {/* Passkey List */}
              {passkeys.length > 0 && (
                <div className="mt-5 space-y-2 animate-in slide-in-from-top-2 fade-in duration-500">
                  {passkeys.map((passkey, idx) => (
                    <div
                      key={passkey.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:shadow-md dark:bg-slate-950 dark:ring-slate-800",
                        "animate-in slide-in-from-left-3 fade-in"
                      )}
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                          <Fingerprint className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {passkey.name || "Biometric passkey"}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {passkey.createdAt
                              ? `Added ${new Intl.DateTimeFormat("en-NG", {
                                  dateStyle: "medium",
                                }).format(new Date(passkey.createdAt))}`
                              : "Active"}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
