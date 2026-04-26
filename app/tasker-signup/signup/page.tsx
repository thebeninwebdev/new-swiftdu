'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { getPostAuthRedirect } from '@/lib/profile-completion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  phoneNumber: string
  studentId: string
  bankName: string
  accountNumber: string
  accountName: string
}

interface CloudinaryResult {
  secure_url: string
  public_id: string
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = ['Profile', 'Identity', 'Bank Details']

// ─── Component ───────────────────────────────────────────────────────────────

export default function TaskerSignupPage() {
  const router = useRouter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  // Profile image
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<CloudinaryResult | null>(null)

  const [formData, setFormData] = useState<FormData>({
    phoneNumber: '',
    studentId: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Session fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) {
          router.push('/login')
          return
        }

        const nextPath = getPostAuthRedirect(data.user, '/tasker-signup/signup')
        if (nextPath !== '/tasker-signup/signup') {
          router.replace(nextPath)
          return
        }

        setUser(data.user)
      } catch {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    getSession()
  }, [router])

  // ── Image handling ─────────────────────────────────────────────────────────

  const applySelectedImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setUploadedImage(null)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    applySelectedImage(file)
    e.target.value = ''
  }

  const uploadToCloudinary = async (): Promise<CloudinaryResult | null> => {
    if (!imageFile) return null

    setIsUploadingImage(true)
    try {
      const formDataObj = new FormData()
      formDataObj.append('file', imageFile)
      formDataObj.append(
        'upload_preset',
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'tasker_profiles'
      )

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formDataObj }
      )

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const result: CloudinaryResult = {
        secure_url: data.secure_url,
        public_id: data.public_id,
      }
      setUploadedImage(result)
      return result
    } catch {
      toast.error('Image upload failed. Please try again.')
      return null
    } finally {
      setIsUploadingImage(false)
    }
  }

  // ── Form helpers ───────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (currentStep === 0) {
      if (!/^(\+234|0)[789][01]\d{8}$/.test(formData.phoneNumber)) {
        newErrors.phoneNumber = 'Enter a valid Nigerian phone number'
      }
    }

    if (currentStep === 1) {
      if (!formData.studentId.trim()) {
        newErrors.studentId = 'Student ID is required'
      }
    }

    if (currentStep === 2) {
      if (!formData.bankName.trim()) newErrors.bankName = 'Bank name is required'
      if (!/^\d{10}$/.test(formData.accountNumber)) {
        newErrors.accountNumber = 'Enter a valid 10-digit account number'
      }
      if (!formData.accountName.trim()) newErrors.accountName = 'Account name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep()) setCurrentStep((s) => s + 1)
  }

  const handleBack = () => setCurrentStep((s) => s - 1)

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep()) return

    setIsSubmitting(true)

    try {
      // Upload image if one was selected but not yet uploaded
      let imageData = uploadedImage
      if (imageFile && !uploadedImage) {
        imageData = await uploadToCloudinary()
        if (!imageData) {
          setIsSubmitting(false)
          return
        }
      }

      const response = await fetch('/api/taskers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: formData.phoneNumber,
          location: user.location || '',
          studentId: formData.studentId,
          profileImage: imageData?.secure_url || null,
          profileImagePublicId: imageData?.public_id || null,
          bankDetails: {
            bankName: formData.bankName,
            accountNumber: formData.accountNumber,
            accountName: formData.accountName,
          },
        }),
      })

      let data
      try { data = await response.json() } catch { data = {} }

      if (!response.ok) {
        toast.error(data.error || 'Failed to create tasker profile')
        return
      }

      setSubmitted(true)
    } catch {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Setting things up…</p>
      </div>
    )
  }

  if (!user) return null

  // ── Success screen ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={styles.root}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✦</div>
          <h1 style={styles.successTitle}>You&rsquo;re on the list.</h1>
          <p style={styles.successBody}>
            Your tasker profile is under review. We&rsquo;ll verify your student ID and
            bank details, then notify you once you&rsquo;re approved to start taking tasks.
          </p>
          <p style={styles.successSub}>This usually takes 1–2 business days.</p>
          <button style={styles.successBtn} onClick={() => router.push('/')}>
            Back to home
          </button>
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Background texture */}
      <div style={styles.bgNoise} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.badge}>Tasker Signup</span>
          <h1 style={styles.title}>Become a Tasker</h1>
          <p style={styles.subtitle}>
            Hi <strong>{user.name?.split(' ')[0]}</strong> — fill in a few details
            to start earning on campus.
          </p>
        </div>

        {/* Step indicators */}
        <div style={styles.stepRow}>
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div style={styles.stepItem}>
                <div
                  style={{
                    ...styles.stepDot,
                    ...(i < currentStep
                      ? styles.stepDotDone
                      : i === currentStep
                      ? styles.stepDotActive
                      : {}),
                  }}
                >
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    ...styles.stepLabel,
                    ...(i === currentStep ? styles.stepLabelActive : {}),
                  }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    ...styles.stepLine,
                    ...(i < currentStep ? styles.stepLineDone : {}),
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div style={styles.card}>
          <form onSubmit={currentStep === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext() }}>

            {/* ── Step 0: Profile ── */}
            {currentStep === 0 && (
              <div style={styles.fieldGroup}>
                <h2 style={styles.stepTitle}>Your Profile</h2>

                {/* Profile image upload */}
                <div style={styles.avatarSection}>
                  <div
                    style={{
                      ...styles.avatarRing,
                      ...(imagePreview ? {} : styles.avatarRingEmpty),
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" style={styles.avatarImg} />
                    ) : (
                      <div style={styles.avatarPlaceholder}>
                        <span style={styles.avatarIcon}>+</span>
                        <span style={styles.avatarHint}>Photo</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p style={styles.avatarLabel}>Profile Picture</p>
                    <p style={styles.avatarSub}>Optional · Max 5MB</p>
                    <button
                      type="button"
                      style={styles.avatarBtn}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imagePreview ? 'Change photo' : 'Upload photo'}
                    </button>
                    <button
                      type="button"
                      style={styles.cameraBtn}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      Take photo
                    </button>
                    <p style={styles.cameraHint}>On mobile, this opens your camera directly.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                </div>

                {/* Read-only fields */}
                <div style={styles.readOnlyGroup}>
                  <FieldReadOnly label="Full Name" value={user.name} />
                  <FieldReadOnly label="Email" value={user.email} />
                  {user.location && (
                    <FieldReadOnly label="Location" value={user.location} />
                  )}
                </div>

                {/* Phone */}
                <Field
                  label="Phone Number"
                  name="phoneNumber"
                  placeholder="e.g. 08012345678"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  error={errors.phoneNumber}
                />
              </div>
            )}

            {/* ── Step 1: Identity ── */}
            {currentStep === 1 && (
              <div style={styles.fieldGroup}>
                <h2 style={styles.stepTitle}>Student Verification</h2>
                <p style={styles.stepDesc}>
                  We use your student ID to verify you&rsquo;re enrolled. This won&rsquo;t be
                  shown publicly.
                </p>
                <Field
                  label="Student ID"
                  name="studentId"
                  placeholder="e.g. CST/2021/001"
                  value={formData.studentId}
                  onChange={handleInputChange}
                  error={errors.studentId}
                />
                <div style={styles.infoBox}>
                  <span style={styles.infoIcon}>ℹ</span>
                  <span>
                    Your ID will be reviewed by our team within 1–2 business days before
                    your account is activated.
                  </span>
                </div>
              </div>
            )}

            {/* ── Step 2: Bank Details ── */}
            {currentStep === 2 && (
              <div style={styles.fieldGroup}>
                <h2 style={styles.stepTitle}>Bank Details</h2>
                <p style={styles.stepDesc}>
                  Payouts go directly to this account after completed tasks.
                </p>
                <Field
                  label="Bank Name"
                  name="bankName"
                  placeholder="e.g. First Bank"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  error={errors.bankName}
                />
                <Field
                  label="Account Number"
                  name="accountNumber"
                  placeholder="10-digit NUBAN"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  error={errors.accountNumber}
                  maxLength={10}
                />
                <Field
                  label="Account Name"
                  name="accountName"
                  placeholder="Name on account"
                  value={formData.accountName}
                  onChange={handleInputChange}
                  error={errors.accountName}
                />
              </div>
            )}

            {/* Navigation */}
            <div style={styles.navRow}>
              {currentStep > 0 && (
                <button type="button" style={styles.backBtn} onClick={handleBack}>
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {currentStep < 2 ? (
                <button type="submit" style={styles.nextBtn}>
                  Next →
                </button>
              ) : (
                <button
                  type="submit"
                  style={{
                    ...styles.nextBtn,
                    ...(isSubmitting || isUploadingImage ? styles.btnDisabled : {}),
                  }}
                  disabled={isSubmitting || isUploadingImage}
                >
                  {isSubmitting || isUploadingImage ? 'Submitting…' : 'Submit Application'}
                </button>
              )}
            </div>
          </form>
        </div>

        <p style={styles.footer}>
          By submitting, you agree to our Terms of Service and Tasker Guidelines.
        </p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label, name, placeholder, value, onChange, error, maxLength,
}: {
  label: string
  name: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  maxLength?: number
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        style={{
          ...styles.input,
          ...(error ? styles.inputError : {}),
        }}
      />
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  )
}

function FieldReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <div style={styles.readOnly}>{value}</div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const COLOR = {
  bg: '#f5f4f0',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#e2dfd8',
  accent: '#2563eb',
  accentDim: 'rgba(37,99,235,0.08)',
  accentText: '#1d4ed8',
  text: '#111110',
  muted: '#6b7280',
  mutedLight: '#9ca3af',
  error: '#dc2626',
  errorDim: 'rgba(220,38,38,0.08)',
  infoText: '#1e40af',
  infoBg: 'rgba(37,99,235,0.06)',
  infoBorder: 'rgba(37,99,235,0.18)',
  success: '#16a34a',
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: COLOR.bg,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px 80px',
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    color: COLOR.text,
    position: 'relative',
    overflowX: 'hidden',
  },
  bgNoise: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `radial-gradient(ellipse 70% 40% at 60% 0%, rgba(37,99,235,0.05) 0%, transparent 65%)`,
    pointerEvents: 'none',
    zIndex: 0,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    position: 'relative',
    zIndex: 1,
  },
  // Header
  header: {
    marginBottom: 32,
  },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: COLOR.accentText,
    background: COLOR.accentDim,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(37,99,235,0.22)',
    borderRadius: 4,
    padding: '3px 10px',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    margin: '0 0 10px',
    color: COLOR.text,
  },
  subtitle: {
    fontSize: 15,
    color: COLOR.muted,
    margin: 0,
    lineHeight: 1.6,
  },
  // Step indicators
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 28,
    gap: 0,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    background: COLOR.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: COLOR.mutedLight,
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  stepDotActive: {
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: COLOR.accent,
    color: COLOR.accent,
    background: COLOR.accentDim,
  },
  stepDotDone: {
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: COLOR.accent,
    background: COLOR.accent,
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 12,
    color: COLOR.muted,
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  stepLabelActive: {
    color: COLOR.text,
    fontWeight: 600,
  },
  stepLine: {
    flex: 1,
    height: 1,
    background: COLOR.border,
    margin: '0 8px',
    minWidth: 20,
    transition: 'background 0.2s',
  },
  stepLineDone: {
    background: COLOR.accent,
  },
  // Card
  card: {
    background: COLOR.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 16,
    padding: '32px 28px',
    marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 4px',
    letterSpacing: '-0.02em',
    color: COLOR.text,
  },
  stepDesc: {
    fontSize: 13,
    color: COLOR.muted,
    margin: '-8px 0 0',
    lineHeight: 1.6,
  },
  // Avatar
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: COLOR.accent,
    transition: 'transform 0.15s',
  },
  avatarRingEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLOR.border,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9f8f6',
    color: COLOR.mutedLight,
    gap: 2,
  },
  avatarIcon: {
    fontSize: 22,
    lineHeight: 1,
  },
  avatarHint: {
    fontSize: 10,
    letterSpacing: '0.05em',
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: 600,
    margin: '0 0 2px',
    color: COLOR.text,
  },
  avatarSub: {
    fontSize: 12,
    color: COLOR.muted,
    margin: '0 0 8px',
  },
  avatarBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.accentText,
    background: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(37,99,235,0.3)',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  cameraBtn: {
    display: 'block',
    marginTop: 8,
    fontSize: 12,
    fontWeight: 700,
    color: '#ffffff',
    background: COLOR.accent,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.accent,
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  cameraHint: {
    fontSize: 11,
    color: COLOR.mutedLight,
    margin: '8px 0 0',
  },
  // Read-only group
  readOnlyGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    padding: '16px',
    background: '#fafaf8',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
  },
  readOnly: {
    fontSize: 14,
    color: COLOR.muted,
    padding: '8px 12px',
    background: '#f3f2ee',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
  },
  // Field
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: COLOR.muted,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    fontSize: 14,
    background: COLOR.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 8,
    color: COLOR.text,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  },
  inputError: {
    borderColor: COLOR.error,
    background: COLOR.errorDim,
  },
  errorText: {
    fontSize: 12,
    color: COLOR.error,
    margin: 0,
  },
  // Info box
  infoBox: {
    display: 'flex',
    gap: 10,
    background: COLOR.infoBg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.infoBorder,
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: COLOR.infoText,
    lineHeight: 1.5,
    alignItems: 'flex-start',
  },
  infoIcon: {
    flexShrink: 0,
    marginTop: 1,
  },
  // Navigation
  navRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 28,
    gap: 12,
  },
  backBtn: {
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
    background: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 8,
    color: COLOR.muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  nextBtn: {
    padding: '11px 28px',
    fontSize: 14,
    fontWeight: 700,
    background: COLOR.accent,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    color: '#ffffff',
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  footer: {
    fontSize: 12,
    color: COLOR.mutedLight,
    textAlign: 'center' as const,
    lineHeight: 1.6,
    margin: 0,
  },
  // Loading
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: COLOR.bg,
    gap: 16,
    fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    width: 32,
    height: 32,
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderTopColor: COLOR.accent,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 14,
    color: COLOR.muted,
    margin: 0,
  },
  // Success
  successCard: {
    maxWidth: 460,
    width: '100%',
    background: COLOR.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLOR.border,
    borderRadius: 20,
    padding: '52px 40px',
    textAlign: 'center' as const,
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  },
  successIcon: {
    fontSize: 40,
    color: COLOR.success,
    marginBottom: 20,
    display: 'block',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    margin: '0 0 14px',
    color: COLOR.text,
  },
  successBody: {
    fontSize: 15,
    color: COLOR.muted,
    lineHeight: 1.7,
    margin: '0 0 8px',
  },
  successSub: {
    fontSize: 13,
    color: COLOR.mutedLight,
    margin: '0 0 32px',
  },
  successBtn: {
    padding: '12px 28px',
    fontSize: 14,
    fontWeight: 700,
    background: COLOR.accent,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}
