const PAYSTACK_API_BASE_URL = 'https://api.paystack.co'

function getPaystackSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()

  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is missing.')
  }

  return secretKey
}

export function getAppBaseUrl(fallbackOrigin?: string) {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    fallbackOrigin ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

async function paystackRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
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

  if (!response.ok) {
    const message =
      payload?.message || payload?.data?.message || 'Paystack request failed.'
    throw new Error(message)
  }

  return payload as T
}

export interface PaystackInitResponse {
  status: boolean
  message?: string
  data?: {
    authorization_url?: string
    access_code?: string
    reference?: string
  }
}

export interface PaystackVerifyResponse {
  status: boolean
  message?: string
  data?: {
    id?: number | string
    reference?: string
    amount?: number | string
    currency?: string
    status?: string
    created_at?: string
    paid_at?: string
  }
}

export async function initializePaystackCheckout(payload: {
  amount: number
  email: string
  reference: string
  customer_name?: string
  phone?: string
  callback_url?: string
  metadata?: Record<string, string | number | boolean>
}) {
  return paystackRequest<PaystackInitResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      amount: Number(payload.amount) * 100, // Convert to kobo
      currency: 'NGN',
      email: payload.email,
      reference: payload.reference,
      callback_url: payload.callback_url,
      metadata: {
        custom_name: payload.customer_name || 'Tasker',
        phone: payload.phone,
        ...payload.metadata,
      },
    }),
  })
}

export async function verifyPaystackPayment(reference: string) {
  const encodedReference = encodeURIComponent(reference)

  return paystackRequest<PaystackVerifyResponse>(
    `/transaction/verify/${encodedReference}`,
    {
      method: 'GET',
    }
  )
}
