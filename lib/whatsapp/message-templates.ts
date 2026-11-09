import type { IMessageTemplate, MessageCategory, MessagePaymentType } from '@/models/message-template'

export interface AllowedVariable {
  key: string
  label: string
  description: string
  sample: string
}

export const ALLOWED_VARIABLES: AllowedVariable[] = [
  {
    key: 'customerName',
    label: 'Customer Name',
    description: "Customer's first name or display name",
    sample: 'Sarah',
  },
  {
    key: 'taskerName',
    label: 'Tasker Name',
    description: "Tasker's name or display name",
    sample: 'David',
  },
  {
    key: 'orderNumber',
    label: 'Order Number',
    description: 'Formatted order identifier',
    sample: 'ABC123',
  },
  {
    key: 'serviceFee',
    label: 'Service Fee',
    description: 'Confirmed SwiftDU service fee (Naira)',
    sample: '₦650',
  },
  {
    key: 'itemTotal',
    label: 'Item Total',
    description: 'Confirmed food or item cost (Naira)',
    sample: '₦2,500',
  },
  {
    key: 'outstandingAmount',
    label: 'Outstanding Amount',
    description: 'Verified outstanding amount due (Naira)',
    sample: '₦3,150',
  },
  {
    key: 'deliveryLocation',
    label: 'Delivery Location',
    description: 'Delivery destination / room number',
    sample: 'Hall 2 - Room 104',
  },
  {
    key: 'storeName',
    label: 'Store Name',
    description: 'Store or cafe name',
    sample: 'Akpan Store',
  },
]

export const ALLOWED_VARIABLE_KEYS = new Set(ALLOWED_VARIABLES.map((v) => v.key))

export interface MessageContext {
  customerName?: string
  taskerName?: string
  orderNumber?: string
  taskType?: string
  isCafeInquiry?: boolean
  cafeInquiryStatus?: string
  orderStatus?: string
  hasPaid?: boolean
  cafeInquiryFeePaid?: boolean
  serviceFee?: number | null
  itemTotal?: number | null
  outstandingAmount?: number | null
  deliveryLocation?: string
  storeName?: string
}

export function validateTemplateBody(body: string): {
  valid: boolean
  errors: string[]
  foundVariables: string[]
} {
  const errors: string[] = []
  const foundVariables: string[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(body)) !== null) {
    const rawKey = match[1].trim()
    foundVariables.push(rawKey)
    if (!ALLOWED_VARIABLE_KEYS.has(rawKey)) {
      errors.push(`Unauthorized variable: "{{${rawKey}}}". Allowed variables are: ${Array.from(ALLOWED_VARIABLE_KEYS).map((k) => `{{${k}}}`).join(', ')}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    foundVariables,
  }
}

export function formatNaira(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₦0'
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export function renderTemplate(
  templateBody: string,
  context: MessageContext,
  sampleMode: boolean = false
): string {
  if (sampleMode) {
    let result = templateBody
    for (const v of ALLOWED_VARIABLES) {
      result = result.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.sample)
    }
    // Clean any residual placeholders
    return result.replace(/\{\{[^}]+\}\}/g, '').trim()
  }

  const replacements: Record<string, string> = {
    customerName: context.customerName?.trim() || 'there',
    taskerName: context.taskerName?.trim() || 'your SwiftDU tasker',
    orderNumber: context.orderNumber?.trim() || '',
    serviceFee: context.serviceFee != null ? formatNaira(context.serviceFee) : '',
    itemTotal: context.itemTotal != null ? formatNaira(context.itemTotal) : '',
    outstandingAmount: context.outstandingAmount != null ? formatNaira(context.outstandingAmount) : '',
    deliveryLocation: context.deliveryLocation?.trim() || 'your destination',
    storeName: context.storeName?.trim() || 'the store',
  }

  let rendered = templateBody
  for (const [key, value] of Object.entries(replacements)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  // Strip any leftover unrecognized placeholders so raw {{...}} is never exposed
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '').trim()

  return rendered
}

export function isTemplateApplicable(
  template: {
    isActive?: boolean
    orderTypes?: string[]
    applicableStates?: string[]
    requiresPaymentVerification?: boolean
    paymentType?: MessagePaymentType
  },
  context: MessageContext
): boolean {
  if (template.isActive === false) return false

  const isCafeInquiry = Boolean(context.isCafeInquiry)
  const taskType = context.taskType || 'general'
  const orderTypes = template.orderTypes && template.orderTypes.length > 0 ? template.orderTypes : ['all']

  // 1. Order type filter
  if (!orderTypes.includes('all')) {
    if (isCafeInquiry) {
      if (!orderTypes.includes('inquiry')) return false
    } else {
      const matchesNormal = orderTypes.includes('normal')
      const matchesSpecific = orderTypes.includes(taskType)
      if (!matchesNormal && !matchesSpecific) return false
    }
  }

  // 2. Applicable states filter
  const applicableStates = template.applicableStates && template.applicableStates.length > 0 ? template.applicableStates : ['all']
  if (!applicableStates.includes('all')) {
    const currentState = isCafeInquiry ? (context.cafeInquiryStatus || context.orderStatus || '') : (context.orderStatus || '')
    if (!applicableStates.includes(currentState)) return false
  }

  // 3. Payment verification
  if (template.requiresPaymentVerification) {
    if (template.paymentType === 'service_fee') {
      // Must be cafe inquiry with unpaid service fee and verified fee amount
      if (!isCafeInquiry) return false
      if (context.cafeInquiryFeePaid) return false
      if (!context.serviceFee || context.serviceFee <= 0) return false
    } else if (template.paymentType === 'items') {
      // Must be cafe inquiry with itemTotal verified and not yet paid
      if (!isCafeInquiry) return false
      if (!context.itemTotal || context.itemTotal <= 0) return false
      if (context.hasPaid) return false
    } else if (template.paymentType === 'total') {
      // Normal order payment: must not have paid and outstanding amount must be verified
      if (context.hasPaid) return false
      if (!context.outstandingAmount || context.outstandingAmount <= 0) return false
    } else {
      // requiresPaymentVerification was set but paymentType is none
      return false
    }
  }

  return true
}

export interface DefaultTemplateSeed {
  title: string
  description: string
  category: MessageCategory
  body: string
  orderTypes: string[]
  applicableStates: string[]
  requiresPaymentVerification: boolean
  paymentType: MessagePaymentType
  displayOrder: number
  isActive: boolean
}

export const DEFAULT_MESSAGE_TEMPLATES: DefaultTemplateSeed[] = [
  // ─── Normal Orders ───
  {
    title: 'Introduce Yourself',
    description: "Let the customer know you're handling their order.",
    category: 'intro',
    body: "Hello {{customerName}}! 👋\n\nI'm {{taskerName}}, your SwiftDU tasker for order #{{orderNumber}}.\nI'll be handling your delivery today.\n\nThank you for choosing SwiftDU! 💜",
    orderTypes: ['normal', 'restaurant', 'indomie', 'water', 'printing', 'copy_notes', 'dry_cleaning'],
    applicableStates: ['all'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 1,
    isActive: true,
  },
  {
    title: 'Request Outstanding Payment',
    description: 'Politely request payment before dispatch.',
    category: 'payment',
    body: "Hello {{customerName}}! 👋\n\nYour SwiftDU order #{{orderNumber}} has an outstanding payment of {{outstandingAmount}}.\n\nIn line with SwiftDU's payment-before-dispatch policy, kindly complete the payment so we can proceed with your errand.\n\nThank you for your understanding! 💜",
    orderTypes: ['normal', 'restaurant', 'indomie', 'water', 'printing', 'copy_notes', 'dry_cleaning'],
    applicableStates: ['pending', 'in_progress'],
    requiresPaymentVerification: true,
    paymentType: 'total',
    displayOrder: 2,
    isActive: true,
  },
  {
    title: 'Order Update',
    description: 'Provide a quick progress update on the order.',
    category: 'update',
    body: 'Hello {{customerName}}! 👋\n\nQuick update on your SwiftDU order #{{orderNumber}}: I am currently working on your request and will keep you updated.\n\nThank you for your patience! 💜',
    orderTypes: ['all'],
    applicableStates: ['all'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 3,
    isActive: true,
  },
  {
    title: 'Item Unavailable',
    description: 'Notify customer that a requested item is out of stock.',
    category: 'unavailable',
    body: 'Hello {{customerName}}! 👋\n\nRegarding your SwiftDU order #{{orderNumber}}: Unfortunately, the requested item is currently unavailable at {{storeName}}.\n\nCould you please let me know if you would like an alternative or prefer to adjust the order?\n\nThank you! 💜',
    orderTypes: ['normal', 'restaurant'],
    applicableStates: ['in_progress'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 4,
    isActive: true,
  },
  {
    title: 'Request Customer Clarification',
    description: 'Ask the customer for necessary details or instructions.',
    category: 'clarification',
    body: "Hello {{customerName}}! 👋\n\nI'm working on your SwiftDU order #{{orderNumber}}. Could you please clarify a quick detail about your request when you have a moment?\n\nThank you! 💜",
    orderTypes: ['all'],
    applicableStates: ['all'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 5,
    isActive: true,
  },
  {
    title: 'Delivery Underway',
    description: 'Notify customer that their delivery is on the way.',
    category: 'delivery',
    body: 'Hello {{customerName}}! 👋\n\nGreat news! Your SwiftDU order #{{orderNumber}} has been picked up and is on the way to {{deliveryLocation}}.\n\nPlease stay reachable. See you shortly! 💜',
    orderTypes: ['all'],
    applicableStates: ['in_progress'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 6,
    isActive: true,
  },
  {
    title: 'Arriving Shortly',
    description: 'Notify customer that you are near their location.',
    category: 'delivery',
    body: 'Hello {{customerName}}! 👋\n\nI have arrived near {{deliveryLocation}} with your SwiftDU order #{{orderNumber}}.\n\nKindly come out or meet me at the pickup point. Thank you! 💜',
    orderTypes: ['all'],
    applicableStates: ['in_progress'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 7,
    isActive: true,
  },

  // ─── Inquiry Orders ───
  {
    title: 'Introduce Yourself (Inquiry)',
    description: "Let the customer know you're checking the cafe for them.",
    category: 'intro',
    body: "Hello {{customerName}}! 👋\n\nI'm {{taskerName}}, your SwiftDU tasker for cafe inquiry #{{orderNumber}}.\nI'll be visiting {{storeName}} to check available items for you.\n\nThank you for choosing SwiftDU! 💜",
    orderTypes: ['inquiry'],
    applicableStates: ['all'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 8,
    isActive: true,
  },
  {
    title: 'Request Inquiry Service Fee',
    description: 'Request the cafe check fee before proceeding.',
    category: 'payment',
    body: 'Hello {{customerName}}! 👋\n\nI have arrived at {{storeName}} for inquiry order #{{orderNumber}}.\n\nKindly complete the inquiry service fee of {{serviceFee}} on SwiftDU so I can check and confirm available items for you.\n\nThank you! 💜',
    orderTypes: ['inquiry'],
    applicableStates: ['checking_cafe', 'awaiting_customer_choice', 'ready_for_payment'],
    requiresPaymentVerification: true,
    paymentType: 'service_fee',
    displayOrder: 9,
    isActive: true,
  },
  {
    title: 'Confirm Item Availability',
    description: 'Share what is currently available at the cafe.',
    category: 'update',
    body: "Hello {{customerName}}! 👋\n\nI'm at {{storeName}} checking your inquiry order #{{orderNumber}}. Here is what is currently available.\n\nPlease let me know your preferred selection and portion! 💜",
    orderTypes: ['inquiry'],
    applicableStates: ['checking_cafe', 'awaiting_customer_choice'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 10,
    isActive: true,
  },
  {
    title: 'Request Payment for Items',
    description: 'Request payment for confirmed items before purchase.',
    category: 'payment',
    body: 'Hello {{customerName}}! 👋\n\nYour requested items for order #{{orderNumber}} have been confirmed totaling {{itemTotal}}.\n\nIn line with our payment-before-dispatch policy, kindly transfer the item payment so I can make the purchase for you.\n\nThank you! 💜',
    orderTypes: ['inquiry'],
    applicableStates: ['ready_for_payment'],
    requiresPaymentVerification: true,
    paymentType: 'items',
    displayOrder: 11,
    isActive: true,
  },
  {
    title: 'Item Unavailable (Inquiry)',
    description: 'Inform customer that their first choice is unavailable.',
    category: 'unavailable',
    body: 'Hello {{customerName}}! 👋\n\nRegarding your cafe inquiry #{{orderNumber}}: Your requested item is currently sold out at {{storeName}}.\n\nWould you like me to check an alternative for you? 💜',
    orderTypes: ['inquiry'],
    applicableStates: ['checking_cafe', 'awaiting_customer_choice'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 12,
    isActive: true,
  },
  {
    title: 'Suggest Alternative',
    description: 'Offer alternative choices available at the cafe.',
    category: 'clarification',
    body: 'Hello {{customerName}}! 👋\n\nFor order #{{orderNumber}}, {{storeName}} has some good alternative options available right now.\n\nLet me know if any of these work for you! 💜',
    orderTypes: ['inquiry'],
    applicableStates: ['checking_cafe', 'awaiting_customer_choice'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 13,
    isActive: true,
  },
  {
    title: 'Delivery Underway (Inquiry)',
    description: 'Notify customer that purchased items are on the way.',
    category: 'delivery',
    body: 'Hello {{customerName}}! 👋\n\nYour order from {{storeName}} has been purchased and is on its way to {{deliveryLocation}}.\n\nPlease be ready to receive your delivery. Thank you! 💜',
    orderTypes: ['inquiry'],
    applicableStates: ['in_progress', 'completed'],
    requiresPaymentVerification: false,
    paymentType: 'none',
    displayOrder: 14,
    isActive: true,
  },
]
