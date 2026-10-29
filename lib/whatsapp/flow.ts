import 'server-only'

import { createHash } from 'node:crypto'

import { firstOrderBonusAvailable } from '@/lib/first-order-bonus'
import { priceWithOrderDiscounts } from '@/lib/first-order-pricing'
import { canCreateOrder, OPERATIONS_SUSPENDED } from '@/lib/operations'
import { getOperationsSettings, getOperationsStatus, formatMinute, getIndomieServiceMode } from '@/lib/operations-settings'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'
import { applyCurrentSessionOrderScope, getActiveAcademicSession } from '@/lib/orders/order-session-scope'
import { cancelCustomerOrder } from '@/lib/orders/customer-order-cancellation'
import { createCustomerOrder, CustomerOrderServiceError } from '@/lib/orders/customer-order-service'
import { SAMMY_TRACKING_ORDER_FIELDS } from '@/lib/orders/order-list-fields'
import { calculateOrderPricing, RESTAURANT_MAX_PEOPLE } from '@/lib/pricing'
import { getConfiguredServiceFee } from '@/lib/pricing-config'
import { isProfileComplete } from '@/lib/profile-completion'
import { hasActiveServiceFeeDiscountReservation } from '@/lib/service-fee-discount'
import { getSiteUrl } from '@/lib/site'
import { resolveVendorDeliveryPricing } from '@/lib/vendors'
import { User } from '@/models/user'
import { Order } from '@/models/order'
import { WhatsAppSession, WHATSAPP_FLOW_VERSION, type IWhatsAppSession, type WhatsAppOrderDraft, type WhatsAppSessionStep } from '@/models/whatsapp-session'
import { getActiveParentLocationOptions, getExactLocationOptions, getWhatsAppVendorOptions, type WhatsAppVendorOption } from './order-options'
import { findLinkedWhatsAppUser, getOrCreatePendingWhatsAppRegistration } from './registration'
import { sendWhatsAppListMessage, sendWhatsAppReplyButtons, sendWhatsAppText, type WhatsAppListSection } from './send-message'

const PAGE_SIZE = 8
const ACTIVE = ['pending', 'in_progress', 'paid']

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || 'there'
}

async function saveSession(session: IWhatsAppSession, step: WhatsAppSessionStep, patch: Partial<WhatsAppOrderDraft> = {}) {
  session.step = step
  session.data = { ...session.data, ...patch }
  session.revision += 1
  await session.save()
}

async function resetSession(session: IWhatsAppSession) {
  session.flowVersion = WHATSAPP_FLOW_VERSION
  session.step = 'MENU'
  session.data = {}
  session.revision += 1
  await session.save()
}

async function sendMenu(phone: string, name?: string | null) {
  await sendWhatsAppListMessage({
    to: phone,
    body: `Hello ${firstName(name)} 👋\nI'm Sammy. What can I help you with?`,
    buttonText: 'Choose',
    sections: [{ rows: [
      { id: 'menu:order', title: 'Place an order' },
      { id: 'menu:track', title: 'Track my order' },
      { id: 'menu:cancel', title: 'Cancel my order' },
      { id: 'menu:support', title: 'Speak to support' },
      { id: 'menu:website', title: 'Open SwiftDU' },
    ] }],
  })
}

async function sendPagedList(phone: string, body: string, buttonText: string, rows: WhatsAppListSection['rows'], page = 0) {
  const maxPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1)
  const safePage = Math.min(maxPage, Math.max(0, page))
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  if (safePage > 0) visible.push({ id: `page:${safePage - 1}`, title: 'Previous' })
  if (safePage < maxPage) visible.push({ id: `page:${safePage + 1}`, title: 'Next' })
  await sendWhatsAppListMessage({ to: phone, body, buttonText, sections: [{ rows: visible }] })
}

async function promptServices(phone: string) {
  await sendWhatsAppListMessage({
    to: phone,
    body: 'What would you like to order?',
    buttonText: 'Choose service',
    sections: [{ rows: [
      { id: 'service:restaurant', title: 'Restaurant Food' },
      { id: 'service:shopping', title: 'Store Shopping' },
      { id: 'service:printing', title: 'Printing Services' },
      { id: 'service:water', title: 'Bag of Water' },
      { id: 'service:indomie', title: 'Indomie' },
    ] }],
  })
}

async function promptVendors(phone: string, draft: WhatsAppOrderDraft, page = 0) {
  const taskType = draft.taskType
  if (!taskType || !['restaurant', 'shopping', 'printing'].includes(taskType)) return
  const vendors = await getWhatsAppVendorOptions(taskType as 'restaurant' | 'shopping' | 'printing')
  const rows = vendors.map((vendor) => ({ id: `vendor:${vendor.id}`, title: vendor.name.slice(0, 24) }))
  if (taskType === 'restaurant' && !draft.cafeInquiry) {
    const coverage = vendors.find((vendor) => /\bakpan\b/i.test(vendor.name))
    if (coverage) rows.unshift({ id: `anywhere:${coverage.id}`, title: 'Choose from anywhere' })
  }
  if (!rows.length) return sendWhatsAppText(phone, 'No vendors are available for this service right now. Try again later.')
  await sendPagedList(phone, `Choose a ${taskType === 'restaurant' ? 'restaurant' : taskType === 'shopping' ? 'store' : 'print shop'}.`, 'Choose', rows, page)
}

async function vendorForDraft(draft: WhatsAppOrderDraft): Promise<WhatsAppVendorOption | null> {
  if (!draft.taskType || !['restaurant', 'shopping', 'printing'].includes(draft.taskType)) return null
  const vendors = await getWhatsAppVendorOptions(draft.taskType as 'restaurant' | 'shopping' | 'printing')
  const id = draft.vendorId || draft.deliveryPricingVendorId
  return vendors.find((vendor) => vendor.id === id) || null
}

async function promptParentLocations(phone: string, draft: WhatsAppOrderDraft, page = 0) {
  const vendor = await vendorForDraft(draft)
  const destinations = vendor?.destinations || await getActiveParentLocationOptions()
  const rows = destinations.map((location) => ({ id: `destination:${location.id}`, title: location.name.slice(0, 24) }))
  if (!rows.length) return sendWhatsAppText(phone, 'No delivery destinations are available right now.')
  await sendPagedList(phone, 'Where should we deliver?', 'Choose location', rows, page)
}

async function promptExactOrRoom(phone: string, session: IWhatsAppSession) {
  const draft = session.data
  const exact = draft.parentLocationId ? await getExactLocationOptions(draft.parentLocationId) : []
  if (exact.length) {
    await saveSession(session, 'EXACT_LOCATION')
    const rows = exact.map((location) => ({ id: `exact:${location.id}`, title: location.name.slice(0, 24) }))
    if (draft.parentLocationType !== 'hostel') rows.unshift({ id: 'exact:skip', title: 'No exact location' })
    await sendPagedList(phone, 'Choose the exact delivery point.', 'Choose point', rows)
    return
  }
  if (draft.requiresRoomNumber) {
    await saveSession(session, 'ROOM_NUMBER')
    await sendWhatsAppText(phone, 'What is your room number?')
    return
  }
  await saveSession(session, 'DELIVERY_DETAIL')
  await sendWhatsAppText(phone, 'Add a room, landmark, or exact detail. Reply SKIP if none.')
}

function makeInput(draft: WhatsAppOrderDraft) {
  const location = draft.parentLocationName || ''
  return {
    taskType: draft.taskType,
    description: draft.description || '',
    amount: draft.amountInput,
    location,
    store: draft.vendorDisplayName,
    vendorId: draft.vendorId,
    deliveryPricingVendorId: draft.deliveryPricingVendorId,
    parentLocationId: draft.parentLocationId,
    exactLocationId: draft.exactLocationId,
    roomNumber: draft.roomNumber,
    deliveryLocation: draft.exactLocationName || draft.deliveryLocation,
    cafeInquiry: draft.cafeInquiry,
    restaurantPeopleCount: draft.restaurantPeopleCount,
    restaurantTakeawayCount: draft.restaurantTakeawayCount,
    packaging: draft.packaging,
    waterBags: draft.waterBags,
    printingServiceType: draft.printingServiceType,
    printingNeedsEditing: draft.printingNeedsEditing,
    numberOfPages: draft.numberOfPages,
    indomiePacks: draft.indomiePacks,
    eggCount: draft.eggCount,
    expectedIndomieMode: draft.expectedIndomieMode,
  }
}

async function quoteDraft(userId: string, draft: WhatsAppOrderDraft) {
  let serviceFee: number | undefined
  const pricingVendorId = draft.vendorId || draft.deliveryPricingVendorId
  if (pricingVendorId && draft.parentLocationId && ['restaurant', 'shopping', 'printing'].includes(draft.taskType || '')) {
    serviceFee = (await resolveVendorDeliveryPricing({
      vendorId: pricingVendorId,
      dropoffParentLocationId: draft.parentLocationId,
      expectedServiceType: draft.taskType || '',
    })).serviceFee
  } else {
    serviceFee = (await getConfiguredServiceFee({ taskType: draft.taskType || '', parentLocationId: draft.parentLocationId })) ?? undefined
  }
  const pricing = calculateOrderPricing({
    taskType: draft.taskType || '',
    amount: draft.taskType === 'water' || draft.taskType === 'printing' || draft.cafeInquiry ? 0 : Number(draft.amountInput),
    store: draft.vendorDisplayName,
    restaurantPeopleCount: draft.restaurantPeopleCount,
    restaurantTakeawayCount: draft.restaurantTakeawayCount,
    cafeInquiry: draft.cafeInquiry,
    waterBags: draft.waterBags,
    indomiePacks: draft.indomiePacks,
    eggCount: draft.eggCount,
    numberOfPages: draft.numberOfPages,
    printingServiceType: draft.printingServiceType,
    printingNeedsEditing: draft.printingNeedsEditing,
    serviceFee,
  })
  const [firstOrder, customer, hasDiscountReservation] = await Promise.all([
    firstOrderBonusAvailable(userId),
    User.findById(userId).select('serviceFeeDiscountEnabled serviceFeeDiscountRemainingOrders').lean(),
    hasActiveServiceFeeDiscountReservation(userId),
  ])
  const serviceFeeDiscount = Boolean(customer?.serviceFeeDiscountEnabled && Number(customer.serviceFeeDiscountRemainingOrders || 0) > 0 && !hasDiscountReservation)
  const final = priceWithOrderDiscounts(pricing, { firstOrderBonus: firstOrder, serviceFeeDiscount, cafeInquiry: draft.cafeInquiry })
  const fingerprint = createHash('sha256').update(JSON.stringify({ input: makeInput(draft), pricing, final })).digest('hex')
  return { pricing, final, fingerprint, serviceFeeDiscount }
}

function naira(value: number | undefined) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`
}

async function showReview(phone: string, userId: string, session: IWhatsAppSession) {
  const quote = await quoteDraft(userId, session.data)
  await saveSession(session, 'REVIEW', { lastQuotedFingerprint: quote.fingerprint })
  const d = session.data
  const lines = [
    `ORDER\n${d.taskType === 'restaurant' ? d.cafeInquiry ? 'Cafe Inquiry' : 'Restaurant Food' : d.taskType === 'shopping' ? 'Store Shopping' : d.taskType === 'printing' ? 'Printing Services' : d.taskType === 'water' ? 'Bag of Water' : 'Indomie'}`,
    d.vendorDisplayName ? `FROM\n${d.vendorDisplayName}` : '',
    d.description ? `ITEMS\n${d.description}` : '',
    d.restaurantPeopleCount ? `FOR\n${d.restaurantPeopleCount} ${d.restaurantPeopleCount === 1 ? 'person' : 'people'}` : '',
    d.packaging ? `PACKAGING\n${d.packaging}${d.restaurantTakeawayCount != null ? ` (${d.restaurantTakeawayCount} takeaway)` : ''}` : '',
    `DELIVER TO\n${[d.parentLocationName, d.exactLocationName || d.roomNumber || d.deliveryLocation].filter(Boolean).join(' · ')}`,
    quote.pricing.amount ? `ORDER ESTIMATE\n${naira(quote.pricing.amount)}` : '',
    `SERVICE FEE\n${naira(quote.pricing.serviceFee)}`,
    quote.final.firstOrderBonusAmount ? `FIRST ORDER DISCOUNT\n-${naira(quote.final.firstOrderBonusAmount)}` : '',
    quote.serviceFeeDiscount ? 'SERVICE FEE DISCOUNT\nApplied' : '',
    `TOTAL\n${naira(quote.final.totalAmount)}`,
  ].filter(Boolean)
  await sendWhatsAppReplyButtons({ to: phone, body: lines.join('\n\n'), buttons: [
    { id: 'review:confirm', title: 'Confirm order' },
    { id: 'review:edit', title: 'Edit' },
    { id: 'review:cancel', title: 'Cancel' },
  ] })
}

async function latestCurrentOrder(userId: string, activeOnly = false) {
  const academicSession = await getActiveAcademicSession()
  const filter = applyCurrentSessionOrderScope({ userId, ...(activeOnly ? { status: { $in: ACTIVE } } : {}) }, academicSession)
  return Order.findOne(filter).select(SAMMY_TRACKING_ORDER_FIELDS).sort({ createdAt: -1 }).lean()
}

async function trackOrder(phone: string, userId: string) {
  const order = await latestCurrentOrder(userId, true) || await latestCurrentOrder(userId)
  if (!order) return sendWhatsAppText(phone, 'You have no orders in the current academic session.')
  const link = `${getSiteUrl()}/dashboard/tasks/${order._id}`
  await sendWhatsAppText(phone, [
    `Order: ${order.description || order.taskType}`,
    `Status: ${String(order.status).replace('_', ' ')}`,
    `Tasker: ${order.taskerName || 'Not assigned yet'}`,
    `Payment: ${order.paymentStatus || (order.hasPaid ? 'paid' : 'unpaid')}`,
    `Total: ${naira(order.totalAmount)}`,
    link,
  ].join('\n'))
}

async function startOrder(phone: string, session: IWhatsAppSession) {
  if (!canCreateOrder(false)) return sendWhatsAppText(phone, OPERATIONS_SUSPENDED.error)
  const settings = await getOperationsSettings()
  const status = getOperationsStatus(new Date(), settings)
  if (!status.open) return sendWhatsAppText(phone, `SwiftDU is closed for today. We open again at ${formatMinute(settings.openMinute)}.`)
  await saveSession(session, 'SERVICE', {})
  await promptServices(phone)
}

async function afterVendor(phone: string, session: IWhatsAppSession) {
  const d = session.data
  if (d.taskType === 'restaurant') {
    if (d.cafeInquiry) {
      await saveSession(session, 'PARENT_LOCATION')
      return promptParentLocations(phone, session.data)
    }
    await saveSession(session, 'DESCRIPTION')
    return sendWhatsAppText(phone, 'What food would you like?')
  }
  if (d.taskType === 'shopping') {
    await saveSession(session, 'DESCRIPTION')
    return sendWhatsAppText(phone, 'What items should we buy?')
  }
  await saveSession(session, 'PRINTING_TYPE')
  return sendWhatsAppReplyButtons({ to: phone, body: 'What do you need?', buttons: [
    { id: 'printing:printing', title: 'Printing' },
    { id: 'printing:photocopying', title: 'Photocopying' },
  ] })
}

function positiveInteger(value: string) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

export async function processWhatsAppConversation({ phone, messageId, text, name }: {
  phone: string; messageId: string; text: string; name?: string
}) {
  const linked = await findLinkedWhatsAppUser(phone)
  if (!linked) {
    const registration = await getOrCreatePendingWhatsAppRegistration(phone, name)
    return sendWhatsAppText(phone, `Link your SwiftDU account to use Sammy:\n${getSiteUrl()}/dashboard/whatsapp/register?token=${registration.token}`)
  }
  if (linked.isSuspended) return sendWhatsAppText(phone, 'Your SwiftDU account cannot use ordering right now. Contact support for help.')

  const profile = await User.findById(linked.id).select('name gender phone location defaultLocation role isSuspended').lean()
  if (!profile || profile.isSuspended) return sendWhatsAppText(phone, 'Your SwiftDU account cannot use ordering right now. Contact support for help.')
  if (!isProfileComplete(profile)) return sendWhatsAppText(phone, `Complete your SwiftDU profile before ordering:\n${getSiteUrl()}/complete-profile`)

  let session = await WhatsAppSession.findOne({ phone })
  if (!session) session = await WhatsAppSession.create({ phone, userId: linked.id, name: linked.name || name, flowVersion: WHATSAPP_FLOW_VERSION, step: 'MENU', data: {} })
  if (session.flowVersion !== WHATSAPP_FLOW_VERSION) await resetSession(session)
  session.userId = linked.id
  session.lastMessageId = messageId

  const input = text.trim()
  const command = input.toLowerCase()
  if (['menu', 'start over'].includes(command)) {
    await resetSession(session)
    return sendMenu(phone, linked.name)
  }
  if (['cancel', 'review:cancel'].includes(command)) {
    await resetSession(session)
    await sendWhatsAppText(phone, 'Order draft cancelled.')
    return sendMenu(phone, linked.name)
  }
  if (command === 'back') {
    await saveSession(session, 'SERVICE')
    return promptServices(phone)
  }

  if (input === 'menu:track') return trackOrder(phone, linked.id)
  if (input === 'menu:support') return sendWhatsAppText(phone, `Support: ${process.env.WHATSAPP_SUPPORT_URL?.trim() || `${getSiteUrl()}/contact-us`}`)
  if (input === 'menu:website') return sendWhatsAppText(phone, getSiteUrl())
  if (input === 'menu:cancel') {
    const order = await latestCurrentOrder(linked.id, true)
    if (!order) return sendWhatsAppText(phone, 'You have no active order to cancel.')
    return sendWhatsAppReplyButtons({ to: phone, body: `Cancel ${order.description || order.taskType}?`, buttons: [
      { id: `cancel-order:${order._id}`, title: 'Cancel order' },
      { id: 'menu', title: 'Keep order' },
    ] })
  }
  if (input.startsWith('cancel-order:')) {
    try {
      await cancelCustomerOrder(linked.id, input.slice('cancel-order:'.length))
      return sendWhatsAppText(phone, 'Your order has been cancelled.')
    } catch (error) {
      return sendWhatsAppText(phone, error instanceof Error ? error.message : 'That order cannot be cancelled.')
    }
  }
  if (input === 'menu:order') return startOrder(phone, session)

  if (input.startsWith('page:')) {
    const page = Number(input.slice(5)) || 0
    if (session.step === 'VENDOR') return promptVendors(phone, session.data, page)
    if (session.step === 'PARENT_LOCATION') return promptParentLocations(phone, session.data, page)
  }

  if (session.step === 'MENU') return sendMenu(phone, linked.name)
  if (session.step === 'SERVICE') {
    const taskType = input.replace('service:', '') as WhatsAppOrderDraft['taskType']
    if (!['restaurant', 'shopping', 'printing', 'water', 'indomie'].includes(taskType || '')) return promptServices(phone)
    session.data = { taskType }
    if (taskType === 'restaurant') {
      await saveSession(session, 'RESTAURANT_MODE')
      return sendWhatsAppReplyButtons({ to: phone, body: 'Do you know what you want?', buttons: [
        { id: 'restaurant:known', title: 'I know what I want' },
        { id: 'restaurant:inquiry', title: "Show what's available" },
      ] })
    }
    if (taskType === 'shopping' || taskType === 'printing') {
      await saveSession(session, 'VENDOR')
      return promptVendors(phone, session.data)
    }
    if (taskType === 'water') {
      await saveSession(session, 'WATER_BAGS')
      return sendWhatsAppText(phone, 'How many bags of water?')
    }
    const operations = await getOperationsSettings()
    const batching = await getIndomieBatchSettings()
    const mode = getIndomieServiceMode({ now: new Date(), operationsSettings: operations, batchingSettings: batching })
    if (mode === 'closed') return sendWhatsAppText(phone, 'Indomie orders are closed for tonight.')
    await saveSession(session, 'INDOMIE_PACKS', { expectedIndomieMode: mode })
    return sendWhatsAppText(phone, 'How many Indomie packs?')
  }
  if (session.step === 'RESTAURANT_MODE') {
    const cafeInquiry = input === 'restaurant:inquiry'
    if (!cafeInquiry && input !== 'restaurant:known') return sendWhatsAppText(phone, 'Choose one of the two options above.')
    await saveSession(session, 'VENDOR', { cafeInquiry })
    return promptVendors(phone, session.data)
  }
  if (session.step === 'VENDOR' && (input.startsWith('vendor:') || input.startsWith('anywhere:'))) {
    const anywhere = input.startsWith('anywhere:')
    const vendorId = input.split(':')[1]
    const vendors = await getWhatsAppVendorOptions(session.data.taskType as 'restaurant' | 'shopping' | 'printing')
    const vendor = vendors.find((item) => item.id === vendorId)
    if (!vendor) return sendWhatsAppText(phone, 'That vendor is no longer available. Choose again.')
    await saveSession(session, 'VENDOR', anywhere
      ? { vendorId: undefined, deliveryPricingVendorId: vendor.id, vendorDisplayName: 'Choose from anywhere' }
      : { vendorId: vendor.id, deliveryPricingVendorId: vendor.id, vendorDisplayName: vendor.name })
    return afterVendor(phone, session)
  }
  if (session.step === 'DESCRIPTION') {
    if (input.length < 5 || input.length > 500) return sendWhatsAppText(phone, 'Please enter at least 5 characters (maximum 500).')
    await saveSession(session, 'AMOUNT', { description: input })
    return sendWhatsAppText(phone, session.data.taskType === 'restaurant' ? 'What is your food estimate in naira? Include expected packaging.' : 'What is your shopping budget in naira?')
  }
  if (session.step === 'AMOUNT') {
    const amount = positiveInteger(input.replace(/[,₦\s]/g, ''))
    if (!amount) return sendWhatsAppText(phone, 'Enter a valid amount in whole naira.')
    if (session.data.taskType === 'restaurant') {
      await saveSession(session, 'RESTAURANT_PEOPLE', { amountInput: amount })
      return sendWhatsAppText(phone, `How many people? Enter 1 to ${RESTAURANT_MAX_PEOPLE}.`)
    }
    await saveSession(session, 'PARENT_LOCATION', { amountInput: amount })
    return promptParentLocations(phone, session.data)
  }
  if (session.step === 'RESTAURANT_PEOPLE') {
    const count = positiveInteger(input)
    if (!count || count > RESTAURANT_MAX_PEOPLE) return sendWhatsAppText(phone, `Enter 1 to ${RESTAURANT_MAX_PEOPLE}.`)
    await saveSession(session, 'PACKAGING', { restaurantPeopleCount: count })
    const buttons = [{ id: 'packaging:takeaway', title: 'Takeaway' }, { id: 'packaging:cellophane', title: 'Cellophane' }]
    if (count > 1) buttons.push({ id: 'packaging:mixed', title: 'Mixed' })
    return sendWhatsAppReplyButtons({ to: phone, body: 'Choose packaging.', buttons })
  }
  if (session.step === 'PACKAGING' && input.startsWith('packaging:')) {
    const packaging = input.split(':')[1] as 'takeaway' | 'cellophane' | 'mixed'
    if (packaging === 'mixed') {
      await saveSession(session, 'TAKEAWAY_COUNT', { packaging })
      return sendWhatsAppText(phone, 'How many orders should be takeaway?')
    }
    await saveSession(session, 'PARENT_LOCATION', { packaging, restaurantTakeawayCount: packaging === 'takeaway' ? session.data.restaurantPeopleCount : 0 })
    return promptParentLocations(phone, session.data)
  }
  if (session.step === 'TAKEAWAY_COUNT') {
    const count = Number(input)
    if (!Number.isInteger(count) || count < 1 || count >= Number(session.data.restaurantPeopleCount)) return sendWhatsAppText(phone, 'Enter a takeaway count smaller than the number of people.')
    await saveSession(session, 'PARENT_LOCATION', { restaurantTakeawayCount: count })
    return promptParentLocations(phone, session.data)
  }
  if (session.step === 'PRINTING_TYPE' && input.startsWith('printing:')) {
    await saveSession(session, 'PRINTING_PAGES', { printingServiceType: input.split(':')[1] as 'printing' | 'photocopying' })
    return sendWhatsAppText(phone, 'How many pages?')
  }
  if (session.step === 'PRINTING_PAGES') {
    const pages = positiveInteger(input)
    if (!pages) return sendWhatsAppText(phone, 'Enter a valid number of pages.')
    await saveSession(session, 'PRINTING_EDITING', { numberOfPages: pages })
    return sendWhatsAppReplyButtons({ to: phone, body: 'Does the file need editing?', buttons: [
      { id: 'editing:yes', title: 'Yes' }, { id: 'editing:no', title: 'No' },
    ] })
  }
  if (session.step === 'PRINTING_EDITING' && input.startsWith('editing:')) {
    await saveSession(session, 'PARENT_LOCATION', { printingNeedsEditing: input === 'editing:yes', description: `${session.data.printingServiceType} job` })
    return promptParentLocations(phone, session.data)
  }
  if (session.step === 'WATER_BAGS') {
    const bags = positiveInteger(input)
    if (!bags) return sendWhatsAppText(phone, 'Enter a valid number of bags.')
    await saveSession(session, 'PARENT_LOCATION', { waterBags: bags })
    return promptParentLocations(phone, session.data)
  }
  if (session.step === 'INDOMIE_PACKS') {
    const packs = positiveInteger(input)
    if (!packs) return sendWhatsAppText(phone, 'Enter a valid number of packs.')
    await saveSession(session, 'INDOMIE_EGGS', { indomiePacks: packs })
    return sendWhatsAppText(phone, 'How many eggs? Enter 0 for none.')
  }
  if (session.step === 'INDOMIE_EGGS') {
    const eggs = Number(input)
    if (!Number.isInteger(eggs) || eggs < 0) return sendWhatsAppText(phone, 'Enter 0 or a whole number.')
    await saveSession(session, 'AMOUNT', { eggCount: eggs, description: `${session.data.indomiePacks} Indomie pack(s), ${eggs} egg(s)` })
    return sendWhatsAppText(phone, 'What is your Indomie budget in naira?')
  }
  if (session.step === 'PARENT_LOCATION' && input.startsWith('destination:')) {
    const id = input.split(':')[1]
    const vendor = await vendorForDraft(session.data)
    const options = vendor?.destinations || await getActiveParentLocationOptions()
    const location = options.find((item) => item.id === id)
    if (!location) return sendWhatsAppText(phone, 'That destination is not available for this order.')
    await saveSession(session, 'PARENT_LOCATION', { parentLocationId: id, parentLocationName: location.name, parentLocationType: location.type, requiresRoomNumber: location.requiresRoomNumber })
    return promptExactOrRoom(phone, session)
  }
  if (session.step === 'EXACT_LOCATION' && input.startsWith('exact:')) {
    if (input === 'exact:skip') {
      if (session.data.requiresRoomNumber) {
        await saveSession(session, 'ROOM_NUMBER')
        return sendWhatsAppText(phone, 'What is your room number?')
      }
      await saveSession(session, 'DELIVERY_DETAIL')
      return sendWhatsAppText(phone, 'Add a landmark or exact detail. Reply SKIP if none.')
    }
    const id = input.split(':')[1]
    const options = await getExactLocationOptions(session.data.parentLocationId || '')
    const exact = options.find((item) => item.id === id)
    if (!exact) return sendWhatsAppText(phone, 'That exact location is not available.')
    if (session.data.requiresRoomNumber) {
      await saveSession(session, 'ROOM_NUMBER', { exactLocationId: exact.id, exactLocationName: exact.name })
      return sendWhatsAppText(phone, 'What is your room number?')
    }
    await saveSession(session, 'DELIVERY_DETAIL', { exactLocationId: exact.id, exactLocationName: exact.name })
    return sendWhatsAppText(phone, 'Add a landmark or extra detail. Reply SKIP if none.')
  }
  if (session.step === 'ROOM_NUMBER') {
    if (!input || input.length > 40) return sendWhatsAppText(phone, 'Enter a room number (maximum 40 characters).')
    await saveSession(session, 'REVIEW', { roomNumber: input })
    return showReview(phone, linked.id, session)
  }
  if (session.step === 'DELIVERY_DETAIL') {
    if (input.length > 120) return sendWhatsAppText(phone, 'Exact delivery detail must be at most 120 characters.')
    await saveSession(session, 'REVIEW', { deliveryLocation: command === 'skip' ? undefined : input })
    return showReview(phone, linked.id, session)
  }
  if (session.step === 'REVIEW' && input === 'review:edit') {
    await saveSession(session, 'SERVICE')
    return promptServices(phone)
  }
  if (session.step === 'REVIEW' && input === 'review:confirm') {
    const fresh = await quoteDraft(linked.id, session.data)
    if (fresh.fingerprint !== session.data.lastQuotedFingerprint) {
      await sendWhatsAppText(phone, 'The price changed while you were ordering. Please review the updated total.')
      return showReview(phone, linked.id, session)
    }
    try {
      const result = await createCustomerOrder({
        id: linked.id,
        name: linked.name,
        email: linked.email,
        role: linked.role,
        source: 'whatsapp',
        customerPhone: phone,
        customerName: linked.name || name,
      }, makeInput(session.data), `whatsapp:${messageId}`)
      const order = result.order
      await resetSession(session)
      return sendWhatsAppText(phone, `${result.recovered ? 'Your order was already placed.' : 'Your order is placed.'}\nStatus: ${order.status}\nTotal: ${naira(Number(order.totalAmount))}\n${getSiteUrl()}/dashboard/tasks/${order._id}`)
    } catch (error) {
      if (error instanceof CustomerOrderServiceError) {
        if (['INDOMIE_MODE_CHANGED', 'INDOMIE_CLOSED', 'OUTSIDE_OPERATING_HOURS'].includes(error.code || '')) await resetSession(session)
        return sendWhatsAppText(phone, error.message)
      }
      throw error
    }
  }

  await sendWhatsAppText(phone, 'I did not understand that. Use the option shown, or reply MENU.')
}
