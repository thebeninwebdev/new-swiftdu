import { randomUUID } from 'crypto'

const PAYSTACK_API_BASE_URL = 'https://api.paystack.co'
const ACCOUNT_VERIFICATION_TTL_MS = 5 * 60 * 1000

function getPaystackSecretKey() {
  const secretKey =
    process.env.PAYSTACK_SECRET_KEY?.trim() || process.env.PAYSTACK_SECRET?.trim()

  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is missing.')
  }

  return secretKey
}

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const payload = await response.json()

  if (!response.ok || payload?.status === false) {
    const message =
      payload?.message || payload?.data?.message || 'Paystack request failed.'
    throw new Error(message)
  }

  return payload as T
}

export interface PaystackBank {
  name: string
  code: string
}

export interface ResolvedBankAccount {
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
}

export class BankDetailsError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export function parseBankAccount(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const bankCode = typeof body.bankCode === 'string' ? body.bankCode.trim() : ''
  const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.trim() : ''
  if (!/^\d{3,12}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) {
    throw new BankDetailsError('Select a bank and enter a 10-digit account number.', 400)
  }
  return { bankCode, accountNumber }
}

let bankCache: { banks: PaystackBank[]; expires: number } | undefined
let bankRequest: Promise<PaystackBank[]> | undefined
const verifiedAccountCache = new Map<string, { userId: string; details: ResolvedBankAccount; expires: number }>()

export function cacheVerifiedBankAccount(userId: string, details: ResolvedBankAccount) {
  const verificationId = randomUUID()
  const now = Date.now()
  for (const [id, entry] of verifiedAccountCache) if (entry.expires <= now) verifiedAccountCache.delete(id)
  verifiedAccountCache.set(verificationId, { userId, details, expires: now + ACCOUNT_VERIFICATION_TTL_MS })
  return verificationId
}

export function getCachedVerifiedBankAccount(userId: string, verificationId: unknown, input: { bankCode: string; accountNumber: string }) {
  if (typeof verificationId !== 'string') return null
  const entry = verifiedAccountCache.get(verificationId)
  if (!entry || entry.expires <= Date.now()) {
    verifiedAccountCache.delete(verificationId)
    return null
  }
  if (entry.userId !== userId || entry.details.bankCode !== input.bankCode || entry.details.accountNumber !== input.accountNumber) return null
  return entry.details
}

export async function listPaystackBanks(): Promise<PaystackBank[]> {
  if (bankCache && bankCache.expires > Date.now()) return bankCache.banks
  if (bankRequest) return bankRequest
  bankRequest = (async () => {
    const banks = new Map<string, PaystackBank>()
    const cursors = new Set<string>()
    let next = ''
    do {
      const query = new URLSearchParams({ country: 'nigeria', currency: 'NGN', perPage: '100', use_cursor: 'true' })
      if (next) query.set('next', next)
      const payload = await paystackRequest<{
        data: { name: string; code: string; active?: boolean }[]
        meta?: { next?: string | null }
      }>(`/bank?${query}`, { signal: AbortSignal.timeout(10000) })
      if (!Array.isArray(payload.data)) throw new Error('Invalid bank list')
      for (const bank of payload.data) {
        if (bank.active !== false && typeof bank.name === 'string' && /^\d{3,12}$/.test(bank.code)) {
          banks.set(bank.code, { name: bank.name, code: bank.code })
        }
      }
      next = payload.meta?.next || ''
      if (next && cursors.has(next)) throw new Error('Invalid bank pagination')
      cursors.add(next)
    } while (next)
    if (!banks.size) throw new Error('Empty bank list')
    const result = [...banks.values()].sort((a, b) => a.name.localeCompare(b.name))
    bankCache = { banks: result, expires: Date.now() + 60 * 60 * 1000 }
    return result
  })()
  try {
    return await bankRequest
  } catch {
    throw new BankDetailsError('Could not load banks. Please try again.', 502)
  } finally {
    bankRequest = undefined
  }
}

export async function resolvePaystackBankAccount(input: unknown): Promise<ResolvedBankAccount> {
  const { bankCode, accountNumber } = parseBankAccount(input)
  const bank = (await listPaystackBanks()).find((item) => item.code === bankCode)
  if (!bank) throw new BankDetailsError('Select a supported Nigerian bank.', 400)
  try {
    const query = new URLSearchParams({ bank_code: bankCode, account_number: accountNumber })
    const payload = await paystackRequest<{
      data?: { account_name?: string; account_number?: string }
    }>(`/bank/resolve?${query}`, { signal: AbortSignal.timeout(10000) })
    const accountName = payload.data?.account_name?.trim()
    if (!accountName || payload.data?.account_number !== accountNumber) throw new Error('Invalid resolution')
    return { bankName: bank.name, bankCode, accountNumber, accountName }
  } catch {
    throw new BankDetailsError("We couldn't verify this account. Check your bank and account number.", 502)
  }
}

export interface PaystackInitializeResponse {
  status?: boolean
  message?: string
  data?: {
    authorization_url?: string
    access_code?: string
    reference?: string
  }
}

export interface PaystackVerifyResponse {
  status?: boolean
  message?: string
  data?: {
    id?: number | string
    reference?: string
    amount?: number
    currency?: string
    status?: string
    paid_at?: string
    paidAt?: string
    gateway_response?: string
  }
}

export async function initializePaystackTransaction(payload: {
  amount: number
  email: string
  reference: string
  callback_url: string
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Record<string, unknown>
  channels?: string[]
}) {
  return paystackRequest<PaystackInitializeResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      amount: String(payload.amount),
      currency: 'NGN',
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    }),
  })
}

export async function verifyPaystackTransaction(reference: string) {
  const encodedReference = encodeURIComponent(reference)

  return paystackRequest<PaystackVerifyResponse>(
    `/transaction/verify/${encodedReference}`,
    {
      method: 'GET',
    }
  )
}
