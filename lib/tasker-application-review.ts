export type ApplicationCheckStatus = 'valid' | 'warning' | 'invalid'

export type ApplicationCheck = {
  status: ApplicationCheckStatus
  label: string
  message: string
}

export type TaskerApplicationInput = {
  name?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  studentId?: string | null
  level?: string | null
  availability?: string[] | null
  motivation?: string | null
  motivationOther?: string | null
}

export type ApplicationReview = {
  checks: ApplicationCheck[]
  status: ApplicationCheckStatus
  attentionCount: number
}

const REQUIRED_FIELDS: Array<[keyof TaskerApplicationInput, string]> = [
  ['name', 'Applicant name'], ['email', 'Email address'], ['phone', 'Phone number'],
  ['location', 'Location'], ['studentId', 'Matric number'], ['level', 'Level'], ['motivation', 'Motivation'],
]

export function normalizeMatricNumber(value?: string | null) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

export function reviewTaskerApplication(application: TaskerApplicationInput): ApplicationReview {
  const checks: ApplicationCheck[] = []
  const missing = REQUIRED_FIELDS.filter(([field]) => !String(application[field] || '').trim()).map(([, label]) => label)
  if (!application.availability?.length) missing.push('Availability')
  if (application.motivation === 'Other' && !String(application.motivationOther || '').trim()) missing.push('Motivation detail')
  checks.push(missing.length ? { status: 'invalid', label: 'Required information', message: `Missing: ${missing.join(', ')}.` } : { status: 'valid', label: 'Required information', message: 'Required application information is provided.' })

  const email = String(application.email || '').trim()
  checks.push(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { status: 'valid', label: 'Email', message: 'Email address is properly formatted.' } : { status: 'invalid', label: 'Email', message: 'Email address is malformed.' })

  const phone = String(application.phone || '').replace(/[\s()-]/g, '')
  checks.push(/^(\+234|0)[789][01]\d{8}$/.test(phone) ? { status: 'valid', label: 'Phone number', message: 'Phone number follows the Nigerian mobile format.' } : { status: 'warning', label: 'Phone number', message: 'Phone number needs verification.' })

  const matric = normalizeMatricNumber(application.studentId)
  const parts = matric.split('/')
  const approvedMatricPrefixes = ['CPT', 'CAHS', 'CSM', 'LAW', 'CNA']
  const matricStructured = parts.length === 4 && /^[A-Z]{2,10}$/.test(parts[0]) && /^\d{2}$/.test(parts[1]) && /^\d{2}$/.test(parts[2]) && /^\d{3,8}$/.test(parts[3])
  const hasApprovedMatricPrefix = approvedMatricPrefixes.includes(parts[0])
  if (!matric) checks.push({ status: 'invalid', label: 'Matric number', message: 'Matric number is missing.' })
  else if (!matricStructured) checks.push({ status: 'warning', label: 'Matric number', message: 'Matric number does not match the expected slash-separated WDU structure.' })
  else if (!hasApprovedMatricPrefix) checks.push({ status: 'warning', label: 'Matric number', message: `${matric} has an unrecognised programme prefix. Expected one of: ${approvedMatricPrefixes.join(', ')}.` })
  else checks.push({ status: 'valid', label: 'Matric number', message: `${matric} has a valid structure and approved programme prefix.` })

  if (application.level && !/^\d{3}\s*Level$/i.test(application.level.trim())) checks.push({ status: 'warning', label: 'Level', message: 'Level uses an unexpected format and should be checked.' })
  const attentionCount = checks.filter((check) => check.status !== 'valid').length
  return { checks, status: checks.some((check) => check.status === 'invalid') ? 'invalid' : attentionCount ? 'warning' : 'valid', attentionCount }
}
