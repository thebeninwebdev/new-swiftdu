export type IncomingWhatsAppMessage = {
  phone: string
  messageId: string
  text: string
  name?: string
}
type Payload = {
  entry?: Array<{ changes?: Array<{ value?: {
    contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
    messages?: Array<{
      from?: string
      id?: string
      type?: string
      text?: { body?: string }
      interactive?: {
        list_reply?: { id?: string; title?: string }
        button_reply?: { id?: string; title?: string }
      }
    }>
  } }> }>
}

export function parseWhatsAppMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const result: IncomingWhatsAppMessage[] = []
  for (const entry of (payload as Payload)?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value
      const contactName = value?.contacts?.[0]?.profile?.name
      for (const message of value?.messages || []) {
        const phone = String(message.from || '').replace(/\D/g, '')
        const messageId = String(message.id || '').trim()
        const text = message.text?.body || message.interactive?.list_reply?.id ||
          message.interactive?.button_reply?.id || ''
        if (phone && messageId && text) result.push({ phone, messageId, text: text.trim(), name: contactName })
      }
    }
  }
  return result
}
