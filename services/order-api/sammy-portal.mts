import type { IncomingMessage, ServerResponse } from 'node:http'
import { SammyApiError } from '@/lib/sammy/server'
import { checkPortalChallenge, confirmPortalCode, sendPortalCode, type PortalPurpose } from '@/lib/sammy/portal-linking'

const PORTAL_ROUTES = new Set([
  'GET /telegram/connect',
  'POST /telegram/connect/request-code',
  'POST /telegram/connect/confirm',
  'GET /whatsapp/connect',
  'POST /whatsapp/connect/request-code',
  'POST /whatsapp/connect/confirm',
])
const FORM_MAX_BYTES = 8192

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
  const alert = message
    ? `<p role="status" class="notice">${escapeHtml(message)}</p>`
    : ''
  const content = completed
    ? `<p>Your account has been connected. You can return to your chat.</p>${resultUrl ? `<p><a href="${escapeHtml(resultUrl)}">Return to Telegram</a></p>` : ''}`
    : `<p>Use the verified email address on your existing SwiftDU account to confirm ownership. No Vercel login is required.</p>
      ${alert}
      <form action="${action}/request-code" method="post">
        ${tokenInput}
        <label for="email">SwiftDU account email</label>
        <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
        <button type="submit">Send verification code</button>
      </form>
      <form action="${action}/confirm" method="post">
        ${tokenInput}
        <label for="code">8-digit email verification code</label>
        <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required>
        <button type="submit">Confirm connection</button>
      </form>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>body{margin:0;padding:32px 16px;background:#f6f7fb;color:#1b2030;font:16px system-ui,sans-serif}main{max-width:450px;margin:40px auto;padding:28px;background:white;border-radius:18px;box-shadow:0 6px 28px #0001}h1{font-size:24px}form{padding:16px 0;border-top:1px solid #eee;margin-top:20px}label{display:block;font-weight:650;margin:10px 0 6px}input,button{display:block;width:100%;box-sizing:border-box;padding:13px;margin:7px 0 16px;border:1px solid #bbb;border-radius:9px;font:inherit}button{background:#4b2387;color:white;border:0;font-weight:600;cursor:pointer}.notice{padding:12px;background:#eee5ff;border-radius:9px}a{color:#4b2387}</style></head><body><main><h1>${title}</h1>${content}<p style="font-size:12px;color:#626a7a">Verification codes expire after 10 minutes. SwiftDU staff will never ask for your code.</p></main></body></html>`
}

async function readForm(request: IncomingMessage) {
  const type = String(request.headers['content-type'] || '')
  if (!type.startsWith('application/x-www-form-urlencoded')) {
    throw new SammyApiError(415, 'UNSUPPORTED_CONTENT_TYPE', 'Please use the provided connection form.')
  }
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > FORM_MAX_BYTES) throw new SammyApiError(413, 'TOO_LARGE', 'The submitted form is too large.')
    chunks.push(buffer)
  }
  const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
  const token = params.get('token') || ''
  if (token.length > 128) throw new SammyApiError(400, 'BAD_TOKEN', 'Invalid connection link.')
  return { token, email: params.get('email'), code: params.get('code') }
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

    // Origin check complements the high-entropy per-user challenge token.
    const host = request.headers.host || ''
    const origin = String(request.headers.origin || '')
    const expected = `https://${host}`
    if (process.env.NODE_ENV === 'production' && (!origin || origin !== expected)) {
      throw new SammyApiError(403, 'INVALID_ORIGIN', 'The connection form was rejected.')
    }
    const form = await readForm(request)
    token = form.token
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
    throw new SammyApiError(404, 'NOT_FOUND', 'Not found.')
  } catch (error) {
    const status = error instanceof SammyApiError ? error.status : 500
    const message = error instanceof SammyApiError ? error.message : 'Verification is unavailable. Please try again later.'
    if (!(error instanceof SammyApiError)) {
      console.error('[Sammy Portal] unexpected error', { purpose, name: error instanceof Error ? error.name : 'Error' })
    }
    html(response, status, page(purpose, token, message))
    return true
  }
}
