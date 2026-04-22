const PAYSTACK_API_BASE_URL = 'https://api.paystack.co'

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
