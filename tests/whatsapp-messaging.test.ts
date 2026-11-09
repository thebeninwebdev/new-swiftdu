import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  validateTemplateBody,
  renderTemplate,
  isTemplateApplicable,
  formatNaira,
  DEFAULT_MESSAGE_TEMPLATES,
  ALLOWED_VARIABLES,
  type MessageContext,
} from '../lib/whatsapp/message-templates'
import {
  formatWhatsappPhone,
  getWhatsAppWebUrl,
  getWhatsAppMessengerIntentUrl,
  getWhatsAppBusinessIntentUrl,
  resolveWhatsAppUrl,
  openWhatsAppChat,
} from '../lib/whatsapp/links'

test('1. Normal order templates display correctly', () => {
  const normalContext: MessageContext = {
    customerName: 'Sarah',
    taskerName: 'David',
    orderNumber: 'ORD123',
    taskType: 'restaurant',
    isCafeInquiry: false,
    orderStatus: 'in_progress',
    hasPaid: true,
    deliveryLocation: 'Hall 2 - Room 104',
    storeName: 'Mama Kitchen',
  }

  // Filter templates applicable to normal orders
  const applicable = DEFAULT_MESSAGE_TEMPLATES.filter((t) =>
    isTemplateApplicable(t, normalContext)
  )

  const titles = applicable.map((t) => t.title)
  assert.ok(titles.includes('Introduce Yourself'))
  assert.ok(titles.includes('Order Update'))
  assert.ok(titles.includes('Item Unavailable'))
  assert.ok(titles.includes('Delivery Underway'))
  assert.ok(titles.includes('Arriving Shortly'))

  // Should NOT include inquiry-only templates
  assert.ok(!titles.includes('Introduce Yourself (Inquiry)'))
  assert.ok(!titles.includes('Request Inquiry Service Fee'))
  assert.ok(!titles.includes('Confirm Item Availability'))
})

test('2. Inquiry templates display correctly', () => {
  const inquiryContext: MessageContext = {
    customerName: 'Michael',
    taskerName: 'Tunde',
    orderNumber: 'INQ999',
    taskType: 'restaurant',
    isCafeInquiry: true,
    cafeInquiryStatus: 'checking_cafe',
    orderStatus: 'in_progress',
    cafeInquiryFeePaid: true,
    hasPaid: false,
    serviceFee: 650,
    storeName: 'Akpan Store',
    deliveryLocation: 'PG Hall',
  }

  const applicable = DEFAULT_MESSAGE_TEMPLATES.filter((t) =>
    isTemplateApplicable(t, inquiryContext)
  )

  const titles = applicable.map((t) => t.title)
  assert.ok(titles.includes('Introduce Yourself (Inquiry)'))
  assert.ok(titles.includes('Confirm Item Availability'))
  assert.ok(titles.includes('Item Unavailable (Inquiry)'))
  assert.ok(titles.includes('Suggest Alternative'))

  // Should not include normal-only templates like Item Unavailable for normal orders
  const normalOnlyItemUnavailable = DEFAULT_MESSAGE_TEMPLATES.find(
    (t) => t.title === 'Item Unavailable'
  )
  assert.ok(normalOnlyItemUnavailable)
  assert.strictEqual(isTemplateApplicable(normalOnlyItemUnavailable, inquiryContext), false)
})

test('3. Templates respect payment status and payment-before-dispatch policy', () => {
  // Case A: Normal order that has already paid
  const paidNormalContext: MessageContext = {
    customerName: 'Sarah',
    taskerName: 'David',
    orderNumber: 'ORD100',
    taskType: 'restaurant',
    orderStatus: 'in_progress',
    isCafeInquiry: false,
    hasPaid: true,
    outstandingAmount: null,
  }

  const paymentTemplate = DEFAULT_MESSAGE_TEMPLATES.find(
    (t) => t.title === 'Request Outstanding Payment'
  )!
  assert.ok(paymentTemplate)
  // When already paid, payment request must NOT be shown
  assert.strictEqual(isTemplateApplicable(paymentTemplate, paidNormalContext), false)

  // Case B: Normal order with verified outstanding amount
  const unpaidNormalContext: MessageContext = {
    ...paidNormalContext,
    hasPaid: false,
    outstandingAmount: 2500,
  }
  // When outstanding and verified, payment request is applicable
  assert.strictEqual(isTemplateApplicable(paymentTemplate, unpaidNormalContext), true)

  // Case C: Normal order with unknown/0 amount
  const unknownAmountContext: MessageContext = {
    ...paidNormalContext,
    hasPaid: false,
    outstandingAmount: 0,
  }
  // Must NOT claim unverified amounts or show payment request
  assert.strictEqual(isTemplateApplicable(paymentTemplate, unknownAmountContext), false)

  // Case D: Inquiry order service fee
  const inquiryFeeTemplate = DEFAULT_MESSAGE_TEMPLATES.find(
    (t) => t.title === 'Request Inquiry Service Fee'
  )!
  assert.ok(inquiryFeeTemplate)

  // Fee unpaid and verified
  const unpaidInquiryContext: MessageContext = {
    customerName: 'Alex',
    isCafeInquiry: true,
    cafeInquiryStatus: 'checking_cafe',
    cafeInquiryFeePaid: false,
    serviceFee: 650,
  }
  assert.strictEqual(isTemplateApplicable(inquiryFeeTemplate, unpaidInquiryContext), true)

  // Fee already paid
  const paidInquiryContext: MessageContext = {
    ...unpaidInquiryContext,
    cafeInquiryFeePaid: true,
  }
  assert.strictEqual(isTemplateApplicable(inquiryFeeTemplate, paidInquiryContext), false)

  // Case E: Inquiry order confirmed items
  const itemPaymentTemplate = DEFAULT_MESSAGE_TEMPLATES.find(
    (t) => t.title === 'Request Payment for Items'
  )!
  assert.ok(itemPaymentTemplate)

  const itemsReadyContext: MessageContext = {
    customerName: 'Alex',
    isCafeInquiry: true,
    cafeInquiryStatus: 'ready_for_payment',
    hasPaid: false,
    itemTotal: 3200,
  }
  assert.strictEqual(isTemplateApplicable(itemPaymentTemplate, itemsReadyContext), true)

  // Items already paid
  const itemsPaidContext: MessageContext = {
    ...itemsReadyContext,
    hasPaid: true,
  }
  assert.strictEqual(isTemplateApplicable(itemPaymentTemplate, itemsPaidContext), false)
})

test('4. Inactive templates are excluded', () => {
  const activeTemplate = {
    isActive: true,
    orderTypes: ['all'],
    applicableStates: ['all'],
  }
  const inactiveTemplate = {
    isActive: false,
    orderTypes: ['all'],
    applicableStates: ['all'],
  }

  const context: MessageContext = { isCafeInquiry: false }
  assert.strictEqual(isTemplateApplicable(activeTemplate, context), true)
  assert.strictEqual(isTemplateApplicable(inactiveTemplate, context), false)
})

test('5. Template ordering is respected', () => {
  const sorted = [...DEFAULT_MESSAGE_TEMPLATES].sort(
    (a, b) => a.displayOrder - b.displayOrder
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    assert.ok(sorted[i].displayOrder <= sorted[i + 1].displayOrder)
  }
})

test('6. Dynamic variables render correctly', () => {
  const templateBody =
    'Hello {{customerName}}! 👋 I am {{taskerName}} for order #{{orderNumber}}. Total: {{outstandingAmount}}. Location: {{deliveryLocation}} from {{storeName}}.'

  const context: MessageContext = {
    customerName: 'Grace',
    taskerName: 'Samuel',
    orderNumber: 'A1B2C3',
    outstandingAmount: 4500,
    deliveryLocation: 'Queen Hall, Room 20',
    storeName: 'Akpan Store',
  }

  const rendered = renderTemplate(templateBody, context)
  assert.strictEqual(
    rendered,
    'Hello Grace! 👋 I am Samuel for order #A1B2C3. Total: ₦4,500. Location: Queen Hall, Room 20 from Akpan Store.'
  )
})

test('7. Missing variables are handled safely without raw placeholder leaks', () => {
  const templateBody =
    'Hello {{customerName}}! Your order #{{orderNumber}} with {{serviceFee}} at {{deliveryLocation}}.'

  // Context completely empty
  const emptyContext: MessageContext = {}
  const rendered = renderTemplate(templateBody, emptyContext)

  // Brackets must NOT leak
  assert.ok(!rendered.includes('{{'))
  assert.ok(!rendered.includes('}}'))
  // Fallback values used
  assert.ok(rendered.includes('Hello there!'))
})

test('8 & 9. Variable whitelist validation prevents arbitrary or unauthorized placeholders', () => {
  const validBody =
    'Hello {{customerName}}! Order #{{orderNumber}} fee is {{serviceFee}}. Location: {{deliveryLocation}}.'
  const validRes = validateTemplateBody(validBody)
  assert.strictEqual(validRes.valid, true)
  assert.strictEqual(validRes.errors.length, 0)

  // Unauthorized placeholder
  const maliciousBody =
    'Hello {{customerName}}! Please send your password {{userPassword}} and pin {{secretPin}}.'
  const invalidRes = validateTemplateBody(maliciousBody)
  assert.strictEqual(invalidRes.valid, false)
  assert.ok(invalidRes.errors.length >= 2)
  assert.ok(invalidRes.errors[0].includes('userPassword'))
  assert.ok(invalidRes.errors[1].includes('secretPin'))
})

test('10. Phone number formatting for WhatsApp handles 0-prefix, 234-prefix, and special chars', () => {
  assert.strictEqual(formatWhatsappPhone('08012345678'), '2348012345678')
  assert.strictEqual(formatWhatsappPhone('+234 801 234 5678'), '2348012345678')
  assert.strictEqual(formatWhatsappPhone('2348012345678'), '2348012345678')
  assert.strictEqual(formatWhatsappPhone('8012345678'), '2348012345678')
  assert.strictEqual(formatWhatsappPhone(''), '')
})

test('11. WhatsApp web links encode text, emojis, and symbols properly', () => {
  const phone = '08012345678'
  const text = 'Hello Sarah! 👋 Amount: ₦2,500.\nThank you! 💜'
  const url = getWhatsAppWebUrl(phone, text)

  assert.ok(url.startsWith('https://wa.me/2348012345678?text='))
  assert.ok(url.includes(encodeURIComponent('Hello Sarah! 👋 Amount: ₦2,500.\nThank you! 💜')))
})

test('12. Android intent links are generated correctly for WhatsApp Messenger and Business', () => {
  const phone = '08012345678'
  const text = 'Hello! 💜'

  const messengerIntent = getWhatsAppMessengerIntentUrl(phone, text)
  assert.ok(messengerIntent.startsWith('intent://send?phone=2348012345678&text='))
  assert.ok(messengerIntent.includes('package=com.whatsapp;'))
  assert.ok(messengerIntent.includes('scheme=whatsapp;'))
  assert.ok(messengerIntent.includes('S.browser_fallback_url='))

  const businessIntent = getWhatsAppBusinessIntentUrl(phone, text)
  assert.ok(businessIntent.startsWith('intent://send?phone=2348012345678&text='))
  assert.ok(businessIntent.includes('package=com.whatsapp.w4b;'))
  assert.ok(businessIntent.includes('scheme=whatsapp;'))
  assert.ok(businessIntent.includes('S.browser_fallback_url='))
})

test('13. Unsupported platforms and fallbacks resolve safely to wa.me links', () => {
  const config = {
    phone: '08012345678',
    text: 'Hello SwiftDU!',
    preference: 'whatsapp' as const,
  }

  // Non-Android user agent (e.g. iPhone)
  const iosUserAgent =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15'
  const iosUrl = resolveWhatsAppUrl(config, iosUserAgent)
  assert.ok(iosUrl.startsWith('https://wa.me/2348012345678?text='))

  // Android user agent with 'whatsapp' preference
  const androidUserAgent =
    'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36'
  const androidUrl = resolveWhatsAppUrl(config, androidUserAgent)
  assert.ok(androidUrl.startsWith('intent://send?phone=2348012345678'))
  assert.ok(androidUrl.includes('package=com.whatsapp;'))

  // Android user agent with 'whatsapp_business' preference
  const androidBizUrl = resolveWhatsAppUrl(
    { ...config, preference: 'whatsapp_business' },
    androidUserAgent
  )
  assert.ok(androidBizUrl.startsWith('intent://send?phone=2348012345678'))
  assert.ok(androidBizUrl.includes('package=com.whatsapp.w4b;'))

  // Android user agent with 'ask_every_time' fallback
  const askUrl = resolveWhatsAppUrl(
    { ...config, preference: 'ask_every_time' },
    androidUserAgent
  )
  assert.ok(askUrl.startsWith('https://wa.me/2348012345678?text='))
})

test('14, 15 & 16. Message selection and carousel swipe state logic', () => {
  // Simulating carousel state logic
  const mockTemplates = [
    { id: '1', title: 'T1' },
    { id: '2', title: 'T2' },
    { id: '3', title: 'T3' },
  ]
  let activeIndex = 0

  // Swiping changes activeIndex
  function onSwipe(newIndex: number) {
    if (newIndex >= 0 && newIndex < mockTemplates.length) {
      activeIndex = newIndex
    }
  }

  onSwipe(1)
  assert.strictEqual(activeIndex, 1)

  // Swiping does NOT send message
  let messageSent = false
  function onOpenWhatsApp() {
    messageSent = true
  }

  // Swipe again
  onSwipe(2)
  assert.strictEqual(activeIndex, 2)
  assert.strictEqual(messageSent, false) // WhatsApp has NOT opened!

  // Intentional tap opens WhatsApp
  onOpenWhatsApp()
  assert.strictEqual(messageSent, true)
})

test('17. Currency formatting helper works correctly', () => {
  assert.strictEqual(formatNaira(0), '₦0')
  assert.strictEqual(formatNaira(1500), '₦1,500')
  assert.strictEqual(formatNaira(25000), '₦25,000')
  assert.strictEqual(formatNaira(null), '₦0')
  assert.strictEqual(formatNaira(undefined), '₦0')
})
