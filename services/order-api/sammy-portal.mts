import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PortalPurpose } from '@/lib/sammy/portal-linking'

const { checkPortalChallenge, confirmPortalCode, sendPortalCode } =
  await import('@/lib/sammy/portal-linking')

class PortalError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

function isPortalError(error: unknown): error is Error & { status: number; code: string } {
  return error instanceof Error &&
    'status' in error && typeof error.status === 'number' &&
    'code' in error && typeof error.code === 'string' &&
    error.status >= 400 && error.status <= 599
}

const PORTAL_ROUTES = new Set([
  'GET /telegram/connect',
  'POST /telegram/connect/request-code',
  'POST /telegram/connect/confirm',
  'GET /whatsapp/connect',
  'POST /whatsapp/connect/request-code',
  'POST /whatsapp/connect/confirm',
])
const FORM_MAX_BYTES = 8192
const FORM_PROOF_LIFETIME_MS = 20 * 60 * 1000
const DEFAULT_PORTAL_ORIGIN = 'https://swiftdu-orders.onrender.com'

/**
 * Some Telegram in-app webviews omit the Origin header on a normal form POST.
 * Use a short-lived signed form proof in addition to rejecting known cross-site
 * submissions. The proof is tied to the unguessable linking token and channel.
 * There is no cookie or dependency on the public/Vercel website.
 */
function formSigningKey() {
  const key = process.env.SAMMY_LINK_OTP_SECRET?.trim()
  return key && key.length >= 32 ? key : null
}

function formSignature(secret: string, purpose: PortalPurpose, token: string, expiry: string) {
  return createHmac('sha256', secret)
    .update(`sammy-portal-form-v1:${purpose}:${token}:${expiry}`)
    .digest('hex')
}

export function issuePortalFormProof(purpose: PortalPurpose, token: string, now = Date.now()) {
  const secret = formSigningKey()
  if (!secret) return null
  const expiry = (now + FORM_PROOF_LIFETIME_MS).toString(36)
  return `${expiry}.${formSignature(secret, purpose, token, expiry)}`
}

export function assertPortalFormAllowed(
  headers: IncomingMessage['headers'],
  purpose: PortalPurpose,
  token: string,
  proof: string | null,
  now = Date.now()
) {
  const rejected = () => new PortalError(403, 'INVALID_FORM_PROOF', 'The connection form was rejected. Open a fresh link from Sammy.')
  // A real cross-origin browser submission remains forbidden.
  const fetchSite = String(headers['sec-fetch-site'] || '').toLowerCase()
  if (fetchSite === 'cross-site') throw rejected()
  const origin = String(headers.origin || '').trim()
  const publicOrigin = process.env.SAMMY_PORTAL_ORIGIN?.trim() || DEFAULT_PORTAL_ORIGIN
  let canonical: string
  try {
    canonical = new URL(publicOrigin).origin
    if (!canonical.startsWith('https://')) throw new Error('The portal must use HTTPS')
  } catch {
    throw new PortalError(503, 'PORTAL_ORIGIN_INVALID', 'Account verification is temporarily unavailable.')
  }
  // Telegram in-app browsers may omit Origin or send the opaque "null" value.
  // Either is accepted ONLY with a fresh signed proof from our own GET page.
  if (origin && origin !== 'null' && origin !== canonical) throw rejected()

  const secret = formSigningKey()
  const match = typeof proof === 'string' && /^([a-z0-9]{1,16})\.([0-9a-f]{64})$/.exec(proof)
  if (!secret || !match) throw rejected()
  const expiry = Number.parseInt(match[1], 36)
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + FORM_PROOF_LIFETIME_MS + 1000) throw rejected()
  const expected = Buffer.from(formSignature(secret, purpose, token, match[1]), 'hex')
  const actual = Buffer.from(match[2], 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw rejected()
}


export function isSammyPortalRoute(method: string, pathname: string) {
  return PORTAL_ROUTES.has(`${method} ${pathname}`)
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function html(response: ServerResponse, status: number, content: string) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  })
  response.end(content)
}

function page(purpose: PortalPurpose, token: string, message = '', resultUrl?: string, completed = false) {
  const title = purpose === 'telegram' ? 'Connect Telegram to SwiftDU' : 'Connect WhatsApp to SwiftDU'
  const action = purpose === 'telegram' ? '/telegram/connect' : '/whatsapp/connect'
  const tokenInput = `<input type="hidden" name="token" value="${escapeHtml(token)}">`
  const proof = issuePortalFormProof(purpose, token)
  const proofInput = proof ? `<input type="hidden" name="csrf" value="${proof}">` : ''
  const alert = message
    ? `<p role="status" class="notice">${escapeHtml(message)}</p>`
    : ''
  const content = completed
    ? `<p>Your account has been connected. You can return to your chat.</p>${resultUrl ? `<p><a href="${escapeHtml(resultUrl)}">Return to Telegram</a></p>` : ''}`
    : !proof
    ? `<p>Account verification is temporarily unavailable. Please try again later.</p>`
    : `<p>Use the verified email address on your existing SwiftDU account to confirm ownership. No Vercel login is required.</p>
      ${alert}
      <form action="${action}/request-code" method="post">
        ${tokenInput}
        ${proofInput}
        <label for="email">SwiftDU account email</label>
        <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
        <button type="submit">Send verification code</button>
      </form>
      <form action="${action}/confirm" method="post">
        ${tokenInput}
        ${proofInput}
        <label for="code">8-digit email verification code</label>
        <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required>
        <button type="submit">Confirm connection</button>
      </form>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>body{margin:0;padding:32px 16px;background:#f6f7fb;color:#1b2030;font:16px system-ui,sans-serif}main{max-width:450px;margin:40px auto;padding:28px;background:white;border-radius:18px;box-shadow:0 6px 28px #0001}h1{font-size:24px}form{padding:16px 0;border-top:1px solid #eee;margin-top:20px}label{display:block;font-weight:650;margin:10px 0 6px}input,button{display:block;width:100%;box-sizing:border-box;padding:13px;margin:7px 0 16px;border:1px solid #bbb;border-radius:9px;font:inherit}button{background:#4b2387;color:white;border:0;font-weight:600;cursor:pointer}.notice{padding:12px;background:#eee5ff;border-radius:9px}a{color:#4b2387}</style></head><body><main><h1>${title}</h1>${content}<p style="font-size:12px;color:#626a7a">Verification codes expire after 10 minutes. SwiftDU staff will never ask for your code.</p></main></body></html>`
}

async function readForm(request: IncomingMessage) {
  const type = String(request.headers['content-type'] || '')
  if (!type.startsWith('application/x-www-form-urlencoded')) {
    throw new PortalError(415, 'UNSUPPORTED_CONTENT_TYPE', 'Please use the provided connection form.')
  }
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > FORM_MAX_BYTES) throw new PortalError(413, 'TOO_LARGE', 'The submitted form is too large.')
    chunks.push(buffer)
  }
  const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
  const token = params.get('token') || ''
  if (token.length > 128) throw new PortalError(400, 'BAD_TOKEN', 'Invalid connection link.')
  return { token, email: params.get('email'), code: params.get('code'), csrf: params.get('csrf') }
}

export async function handleSammyPortal(request: IncomingMessage, response: ServerResponse) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (!isSammyPortalRoute(request.method || '', pathname)) return false
  const purpose: PortalPurpose = pathname.startsWith('/telegram/') ? 'telegram' : 'whatsapp'
  const endpoint = purpose === 'telegram' ? '/telegram/connect' : '/whatsapp/connect'
  let token = ''
  try {
    if (request.method === 'GET') {
      token = new URL(request.url || '/', 'http://localhost').searchParams.get('token') || ''
      await checkPortalChallenge(purpose, token)
      html(response, 200, page(purpose, token))
      return true
    }

    // Do not depend on webview Origin headers or proxy Host matching.
    // The signed form proof rejects tampering and foreign submissions.
    const form = await readForm(request)
    token = form.token
    assertPortalFormAllowed(request.headers, purpose, token, form.csrf)
    if (pathname === endpoint + '/request-code') {
      await sendPortalCode(purpose, token, form.email)
      html(response, 200, page(purpose, token,
        'If this is a verified and eligible SwiftDU account, a verification code has been emailed.'))
      return true
    }
    if (pathname === endpoint + '/confirm') {
      const completed = await confirmPortalCode(purpose, token, form.code)
      html(response, 200, page(purpose, token, 'Connection successful.', completed.returnUrl || undefined, true))
      return true
    }
    throw new PortalError(404, 'NOT_FOUND', 'Not found.')
  } catch (error) {
    const status = isPortalError(error) ? error.status : 500
    const message = isPortalError(error) ? error.message : 'Verification is unavailable. Please try again later.'
    if (!isPortalError(error)) {
      console.error('[Sammy Portal] unexpected error', { purpose, name: error instanceof Error ? error.name : 'Error' })
    }
    html(response, status, page(purpose, token, message))
    return true
  }
}
