import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'

import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import { WhatsAppRegistration } from '@/models/whatsapp-registration'
import { SammyApiError } from './server'
import { isApprovedTelegramStaffAccount, normalizeCustomerPhone } from './staff-policy'

export { isApprovedTelegramStaffAccount, normalizeCustomerPhone } from './staff-policy'

export type TelegramIdentity = {
  id: string
  username?: string
  firstName?: string
  lastName?: string
}

export type SammyStaff = {
  _id: Types.ObjectId
  name?: string
  email: string
  role: string
  isExco?: boolean
  telegramUserId: string
  telegramFirstName?: string
  telegramLastName?: string
  telegramEnabled?: boolean
  isSuspended?: boolean
}

export type StaffCustomer = {
  id: string
  name: string
  phone?: string
  whatsapp?: string
  email?: string
  orderCount: number
  lastOrderAt?: Date
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&')
}

function publicEmail(value?: string | null) {
  const email = String(value || '').trim().toLowerCase()
  return email.endsWith('@customer.swiftdu.invalid') ? undefined : email || undefined
}

export async function resolveSammyStaff(identity: TelegramIdentity) {
  const telegramUserId = String(identity.id || '').trim()
  if (!/^\d+$/.test(telegramUserId)) {
    throw new SammyApiError(400, 'INVALID_TELEGRAM_USER', 'A valid Telegram user ID is required.')
  }

  await connectDB()
  const staff = await User.findOne({ telegramUserId })
    .select('_id name email role isExco isSuspended telegramUserId telegramEnabled telegramFirstName telegramLastName')
    .lean<SammyStaff>()

  if (!isApprovedTelegramStaffAccount(staff, telegramUserId)) {
    throw new SammyApiError(403, 'STAFF_NOT_APPROVED', 'Sammy is only available to approved SwiftDU staff.')
  }

  const snapshot: Record<string, string> = {}
  if (identity.username) snapshot.telegramUsername = identity.username
  if (identity.firstName) snapshot.telegramFirstName = identity.firstName
  if (identity.lastName) snapshot.telegramLastName = identity.lastName
  if (Object.keys(snapshot).length) {
    await User.updateOne({ _id: staff._id }, { $set: snapshot })
  }
  return staff
}

async function toCustomerCards(users: Array<Record<string, unknown>>): Promise<StaffCustomer[]> {
  if (!users.length) return []
  const ids = users.map(user => String(user._id))
  const [registrations, orderStats] = await Promise.all([
    WhatsAppRegistration.find({ userId: { $in: ids }, status: 'linked' })
      .select('userId phone')
      .lean(),
    Order.aggregate<{ _id: string; orderCount: number; lastOrderAt: Date }>([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', orderCount: { $sum: 1 }, lastOrderAt: { $max: '$createdAt' } } },
    ]),
  ])
  const whatsapp = new Map(registrations.map(item => [String(item.userId), item.phone]))
  const stats = new Map(orderStats.map(item => [String(item._id), item]))

  return users.map(user => {
    const id = String(user._id)
    const phones = Array.isArray(user.phones)
      ? user.phones as Array<{ number?: string; type?: string }>
      : []
    const whatsAppPhone = phones.find(phone => phone.type === 'whatsapp')?.number || whatsapp.get(id)
    const primary = String(user.phone || '') || phones.find(phone => phone.type === 'primary')?.number
    return {
      id,
      name: String(user.name || 'Customer'),
      phone: primary || undefined,
      whatsapp: whatsAppPhone || undefined,
      email: publicEmail(String(user.email || '')),
      orderCount: stats.get(id)?.orderCount || 0,
      lastOrderAt: stats.get(id)?.lastOrderAt,
    }
  })
}

const CUSTOMER_FIELDS = '_id name email phone phones'

export async function getStaffCustomer(customerId: string) {
  if (!Types.ObjectId.isValid(customerId)) {
    throw new SammyApiError(400, 'INVALID_CUSTOMER', 'Choose a valid customer.')
  }
  const user = await User.findOne({ _id: customerId, isSuspended: { $ne: true } })
    .select(CUSTOMER_FIELDS)
    .lean()
  if (!user) throw new SammyApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.')
  return (await toCustomerCards([user as unknown as Record<string, unknown>]))[0]
}

export async function getStaffCustomerRecord(customerId: string) {
  if (!Types.ObjectId.isValid(customerId)) {
    throw new SammyApiError(400, 'INVALID_CUSTOMER', 'Choose a valid customer.')
  }
  const user = await User.findOne({ _id: customerId, isSuspended: { $ne: true } })
    .select('_id name email phone phones role taskerId gender location defaultLocation isSuspended isExco excoRole testOrderMode serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders')
    .lean()
  if (!user) throw new SammyApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.')
  return user
}

export async function searchStaffCustomers(rawQuery: unknown, limit = 8) {
  const query = String(rawQuery || '').trim()
  if (query.length < 2) {
    throw new SammyApiError(400, 'INVALID_CUSTOMER_SEARCH', 'Enter at least two characters.')
  }
  await connectDB()

  const conditions: Record<string, unknown>[] = []
  const normalizedPhone = normalizeCustomerPhone(query)
  const looksLikePhone = normalizedPhone.length >= 7 && query.replace(/\D/g, '').length >= 7
  if (looksLikePhone) {
    const lastTen = normalizedPhone.slice(-10)
    const phonePattern = lastTen.split('').join('\\D*')
    conditions.push({ phone: { $regex: phonePattern } })
    conditions.push({ 'phones.normalizedNumber': { $in: [normalizedPhone, lastTen, '0' + lastTen] } })
    const registrations = await WhatsAppRegistration.find({
      status: 'linked',
      userId: { $exists: true, $ne: '' },
      phone: { $regex: escapeRegex(lastTen) + '$' },
    }).select('userId').limit(limit).lean()
    const registrationIds = registrations
      .map(item => String(item.userId))
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id))
    if (registrationIds.length) conditions.push({ _id: { $in: registrationIds } })
  } else if (query.includes('@')) {
    conditions.push({ email: query.toLowerCase() })
  } else {
    conditions.push({ name: { $regex: escapeRegex(query), $options: 'i' } })
    conditions.push({ email: { $regex: escapeRegex(query), $options: 'i' } })
    if (Types.ObjectId.isValid(query)) conditions.push({ _id: new Types.ObjectId(query) })
  }

  const users = await User.find({ isSuspended: { $ne: true }, $or: conditions })
    .select(CUSTOMER_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 10))
    .lean()
  return toCustomerCards(users as unknown as Array<Record<string, unknown>>)
}

export async function createStaffCustomer(input: {
  name?: unknown
  phone?: unknown
  whatsapp?: unknown
  email?: unknown
}, staff: SammyStaff) {
  const name = String(input.name || '').trim().replace(/\s+/g, ' ')
  const phone = normalizeCustomerPhone(String(input.phone || ''))
  const whatsapp = normalizeCustomerPhone(String(input.whatsapp || ''))
  const suppliedEmail = String(input.email || '').trim().toLowerCase()
  if (name.length < 2 || name.length > 120) {
    throw new SammyApiError(400, 'INVALID_CUSTOMER_NAME', 'Enter the customer’s name.')
  }
  if (!phone || phone.length < 10) {
    throw new SammyApiError(400, 'INVALID_PHONE', 'Enter a valid primary phone number.')
  }
  if (suppliedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)) {
    throw new SammyApiError(400, 'INVALID_EMAIL', 'Enter a valid email address or skip it.')
  }

  const contactNumbers = [...new Set([phone, whatsapp].filter(Boolean))]
  const duplicateConditions: Record<string, unknown>[] = [
    { phone: { $regex: escapeRegex(phone.slice(-10)) + '$' } },
    { 'phones.normalizedNumber': { $in: contactNumbers } },
  ]
  if (suppliedEmail) duplicateConditions.push({ email: suppliedEmail })
  const linkedRegistrations = await WhatsAppRegistration.find({
    status: 'linked',
    userId: { $exists: true, $ne: '' },
    $or: contactNumbers.map(number => ({
      phone: { $regex: escapeRegex(number.slice(-10)) + '$' },
    })),
  }).select('userId').lean()
  const linkedUserIds = linkedRegistrations
    .map(item => String(item.userId))
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => new Types.ObjectId(id))
  if (linkedUserIds.length) duplicateConditions.push({ _id: { $in: linkedUserIds } })
  const duplicates = await User.find({ $or: duplicateConditions }).select(CUSTOMER_FIELDS).limit(5).lean()
  if (duplicates.length) {
    return { created: false as const, duplicates: await toCustomerCards(duplicates as unknown as Array<Record<string, unknown>>) }
  }

  const email = suppliedEmail || 'staff-' + randomUUID() + '@customer.swiftdu.invalid'
  const phones = [
    { number: String(input.phone || '').trim(), normalizedNumber: phone, type: 'primary' as const, verified: false },
    ...(whatsapp
      ? [{ number: String(input.whatsapp || input.phone || '').trim(), normalizedNumber: whatsapp, type: 'whatsapp' as const, verified: false }]
      : []),
  ]
  const customer = await User.create({
    name,
    email,
    emailVerified: false,
    role: 'user',
    phone: String(input.phone || '').trim(),
    phones,
    customerSource: 'staff_whatsapp',
    createdByStaffId: String(staff._id),
  })
  return { created: true as const, customer: await getStaffCustomer(String(customer._id)) }
}
