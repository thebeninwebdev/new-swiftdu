import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
) {
  if (!signatureHeader?.startsWith('sha256=') || !appSecret) return false
  const suppliedHex = signatureHeader.slice('sha256='.length)
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false
  const supplied = Buffer.from(suppliedHex, 'hex')
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
