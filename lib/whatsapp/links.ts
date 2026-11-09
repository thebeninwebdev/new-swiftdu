export type WhatsAppAppPreference = 'whatsapp' | 'whatsapp_business' | 'ask_every_time'

export interface WhatsAppLinkConfig {
  phone: string
  text: string
  preference?: WhatsAppAppPreference
}

export function formatWhatsappPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`
  if (digits.length === 10) return `234${digits}`
  return digits
}

export function getWhatsAppWebUrl(phone: string, text: string): string {
  const normalizedPhone = formatWhatsappPhone(phone)
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
}

export function getWhatsAppSchemeUrl(phone: string, text: string): string {
  const normalizedPhone = formatWhatsappPhone(phone)
  return `whatsapp://send?phone=${normalizedPhone}&text=${encodeURIComponent(text)}`
}

export function getWhatsAppMessengerIntentUrl(phone: string, text: string): string {
  const normalizedPhone = formatWhatsappPhone(phone)
  const encodedText = encodeURIComponent(text)
  const fallbackUrl = getWhatsAppWebUrl(normalizedPhone, text)
  return `intent://send?phone=${normalizedPhone}&text=${encodedText}#Intent;package=com.whatsapp;scheme=whatsapp;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
}

export function getWhatsAppBusinessIntentUrl(phone: string, text: string): string {
  const normalizedPhone = formatWhatsappPhone(phone)
  const encodedText = encodeURIComponent(text)
  const fallbackUrl = getWhatsAppWebUrl(normalizedPhone, text)
  return `intent://send?phone=${normalizedPhone}&text=${encodedText}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
}

export function isAndroidUserAgent(userAgent?: string): boolean {
  if (typeof window !== 'undefined' && !userAgent) {
    userAgent = window.navigator.userAgent
  }
  return Boolean(userAgent && /android/i.test(userAgent))
}

export function resolveWhatsAppUrl(config: WhatsAppLinkConfig, userAgent?: string): string {
  const { phone, text, preference = 'ask_every_time' } = config
  const isAndroid = isAndroidUserAgent(userAgent)

  if (isAndroid) {
    if (preference === 'whatsapp') {
      return getWhatsAppMessengerIntentUrl(phone, text)
    }
    if (preference === 'whatsapp_business') {
      return getWhatsAppBusinessIntentUrl(phone, text)
    }
  }

  // Fallback to standard web deep link for non-Android, default, or unselected preference
  return getWhatsAppWebUrl(phone, text)
}

/**
 * Client-side launcher that attempts deep-linking with fallback handling.
 */
export function openWhatsAppChat(
  config: WhatsAppLinkConfig,
  targetApp?: 'whatsapp' | 'whatsapp_business' | 'web'
): { openedUrl: string; appUsed: string } {
  const { phone, text } = config
  const isAndroid = isAndroidUserAgent()
  const webUrl = getWhatsAppWebUrl(phone, text)

  let finalUrl = webUrl
  let appUsed = 'web'

  if (targetApp === 'whatsapp') {
    appUsed = 'WhatsApp Messenger'
    finalUrl = isAndroid ? getWhatsAppMessengerIntentUrl(phone, text) : getWhatsAppSchemeUrl(phone, text)
  } else if (targetApp === 'whatsapp_business') {
    appUsed = 'WhatsApp Business'
    finalUrl = isAndroid ? getWhatsAppBusinessIntentUrl(phone, text) : webUrl
  } else if (config.preference === 'whatsapp') {
    appUsed = 'WhatsApp Messenger'
    finalUrl = isAndroid ? getWhatsAppMessengerIntentUrl(phone, text) : getWhatsAppSchemeUrl(phone, text)
  } else if (config.preference === 'whatsapp_business') {
    appUsed = 'WhatsApp Business'
    finalUrl = isAndroid ? getWhatsAppBusinessIntentUrl(phone, text) : webUrl
  }

  try {
    if (typeof window !== 'undefined') {
      // If Android intent, setting location triggers the intent filter cleanly
      if (finalUrl.startsWith('intent://')) {
        window.location.href = finalUrl
      } else {
        // Universal web URL or whatsapp:// link
        const win = window.open(finalUrl, '_blank', 'noopener,noreferrer')
        if (!win || win.closed || typeof win.closed === 'undefined') {
          // Popup blocked, navigate current window
          window.location.href = finalUrl
        }
      }
    }
  } catch (err) {
    console.warn('[openWhatsAppChat] Deep-link failed, falling back to web URL:', err)
    if (typeof window !== 'undefined') {
      window.location.href = webUrl
    }
  }

  return { openedUrl: finalUrl, appUsed }
}
