const FLUTTERWAVE_API_BASE_URL = 'https://api.flutterwave.com/v3'

function getFlutterwaveSecretKey() {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY?.trim()

  if (!secretKey) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is missing.')
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

async function flutterwaveRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${FLUTTERWAVE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const payload = await response.json()

  if (!response.ok) {
    const message =
      payload?.message || payload?.data?.message || 'Flutterwave request failed.'
    throw new Error(message)
  }

  return payload as T
}

export interface FlutterwaveInitResponse {
  status?: string
  message?: string
  data?: {
    link?: string
  }
}

export interface FlutterwaveVerifyResponse {
  status?: string
  message?: string
  data?: {
    id?: number | string
    tx_ref?: string
    amount?: number | string
    currency?: string
    status?: string
    created_at?: string
    charged_at?: string
  }
}

export async function initializeFlutterwaveCheckout(payload: {
  amount: number
  tx_ref: string
  redirect_url: string
  customer: {
    email: string
    name: string
    phone_number?: string
  }
  customizations?: {
    title?: string
    description?: string
  }
  payment_options?: string
  meta?: Record<string, string | number | boolean>
}) {
  return flutterwaveRequest<FlutterwaveInitResponse>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      currency: 'NGN',
      payment_options: payload.payment_options || 'card,banktransfer,ussd',
      ...payload,
    }),
  })
}

export async function verifyFlutterwavePayment(txRef: string) {
  const encodedReference = encodeURIComponent(txRef)

  return flutterwaveRequest<FlutterwaveVerifyResponse>(
    `/transactions/verify_by_reference?tx_ref=${encodedReference}`,
    {
      method: 'GET',
    }
  )
}

export async function verifyFlutterwaveTransaction(transactionId: string | number) {
  const encodedTransactionId = encodeURIComponent(String(transactionId).trim())

  return flutterwaveRequest<FlutterwaveVerifyResponse>(
    `/transactions/${encodedTransactionId}/verify`,
    {
      method: 'GET',
    }
  )
}
