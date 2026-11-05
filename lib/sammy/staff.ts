import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'

import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import { WhatsAppRegistration } from '@/models/whatsapp-registration'
import CampusLocation from '@/models/campus-location'
import { SammyPhoneAudit, fingerprintSammyPhone } from '@/models/sammy-phone-audit'
import { SammyCustomerRegistrationAudit, fingerprintSammyRegistrationValue } from '@/models/sammy-customer-registration-audit'
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
  telegramRevokedAt?: Date
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
  defaultLocation?: string
  defaultLocationId?: string
  defaultRoomNumber?: string
}

export function isSyntheticCustomerEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase().endsWith('@customer.swiftdu.invalid')
}

function syntheticCustomerEmail() {
  return `staff-${randomUUID()}@customer.swiftdu.invalid`
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&')
}

function publicEmail(value?: string | null) {
  const email = String(value || '').trim().toLowerCase()
  return isSyntheticCustomerEmail(email) ? undefined : email || undefined
}

export async function resolveSammyStaff(identity: TelegramIdentity) {
  const telegramUserId = String(identity.id || '').trim()
  if (!/^\d+$/.test(telegramUserId)) {
    throw new SammyApiError(400, 'INVALID_TELEGRAM_USER', 'A valid Telegram user ID is required.')
  }

  await connectDB()
  const staff = await User.findOne({ telegramUserId })
    .select('_id name email role isExco isSuspended telegramUserId telegramEnabled telegramRevokedAt telegramFirstName telegramLastName')
    .lean<SammyStaff>()

  if (!staff) throw new SammyApiError(403, 'TELEGRAM_NOT_LINKED', 'Connect your SwiftDU account to continue.')
  if (staff.isSuspended) throw new SammyApiError(403, 'STAFF_ACCOUNT_SUSPENDED', 'This SwiftDU account is suspended.')
  if (staff.role !== 'admin' && !staff.isExco) throw new SammyApiError(403, 'STAFF_INSUFFICIENT_PRIVILEGES', 'This account does not have staff access.')
  if (!isApprovedTelegramStaffAccount(staff, telegramUserId)) throw new SammyApiError(403, 'TELEGRAM_ACCESS_DISABLED', 'Telegram access is disabled for this account.')

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
      defaultLocation: String(user.defaultLocation || user.location || '') || undefined,
      defaultLocationId: String(user.defaultLocationId || '') || undefined,
      defaultRoomNumber: String(user.defaultRoomNumber || '') || undefined,
    }
  })
}

const CUSTOMER_FIELDS = '_id name email phone phones location defaultLocation defaultLocationId defaultRoomNumber'

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
    conditions.push({ phones: { $elemMatch: { normalizedNumber: { $in: [normalizedPhone, lastTen, '0' + lastTen] }, verified: true } } })
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
  email?: unknown
  parentLocationId?: unknown
  roomNumber?: unknown
  idempotencyKey?: unknown
}, staff: SammyStaff) {
  const name = String(input.name || '').trim().replace(/\s+/g, ' ')
  const phone = normalizeCustomerPhone(String(input.phone || ''))
  const email = String(input.email || '').trim().toLowerCase()
  const parentLocationId = String(input.parentLocationId || '').trim()
  const roomNumber = String(input.roomNumber || '').trim().replace(/\s+/g, ' ')
  const idempotencyKey = String(input.idempotencyKey || '').trim()
  if (name.length < 3 || name.length > 120 || name.split(' ').length < 2) throw new SammyApiError(400, 'INVALID_NAME', "Enter the customer's full name.")
  if (!/^234[789]\d{9}$/.test(phone)) throw new SammyApiError(400, 'INVALID_PHONE', 'Enter a valid Nigerian phone number.')
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new SammyApiError(400, 'INVALID_EMAIL', 'Enter a valid email address.')
  if (!Types.ObjectId.isValid(parentLocationId)) throw new SammyApiError(400, 'INVALID_HOSTEL', 'Choose a valid hostel.')
  if (roomNumber.length > 40) throw new SammyApiError(400, 'INVALID_ROOM_NUMBER', 'Enter a valid room number.')
  if (idempotencyKey.length < 12 || idempotencyKey.length > 200) throw new SammyApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A stable confirmation ID is required.')

  const previous = await SammyCustomerRegistrationAudit.findOne({ idempotencyKey, staffId: String(staff._id) }).select('customerId').lean()
  if (previous?.customerId) return { created: true as const, customer: await getStaffCustomer(String(previous.customerId)) }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCreations = await SammyCustomerRegistrationAudit.countDocuments({ staffId: String(staff._id), createdAt: { $gte: hourAgo } })
  if (recentCreations >= 20) throw new SammyApiError(429, 'CUSTOMER_CREATION_RATE_LIMITED', 'Too many customers have been created. Try again later.')
  const hostel = await CampusLocation.findOne({ _id: parentLocationId, parentLocationId: null, active: true, type: 'hostel' }).select('_id name').lean()
  if (!hostel) throw new SammyApiError(400, 'INVALID_HOSTEL', 'Choose an active hostel.')

  const lastTen = phone.slice(-10)
  const linkedRegistrations = await WhatsAppRegistration.find({ userId: { $exists: true, $ne: '' }, phone: { $regex: escapeRegex(lastTen) + '$' } }).select('userId').lean()
  const linkedUserIds = linkedRegistrations.map(item => String(item.userId)).filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id))
  const duplicates = await User.find({ $or: [
    { phone: { $regex: escapeRegex(lastTen) + '$' } },
    { 'phones.normalizedNumber': phone },
    ...(email ? [{ email }] : []),
    ...(linkedUserIds.length ? [{ _id: { $in: linkedUserIds } }] : []),
  ] }).select(CUSTOMER_FIELDS).limit(5).lean()
  if (duplicates.length) return { created: false as const, duplicates: await toCustomerCards(duplicates as unknown as Array<Record<string, unknown>>) }

  try {
    const customer = await User.create({
      name,
      email: email || syntheticCustomerEmail(),
      emailVerified: false,
      role: 'user',
      phone,
      phones: [{ number: phone, normalizedNumber: phone, type: 'primary' as const, verified: false }],
      location: hostel.name,
      defaultLocation: hostel.name,
      defaultLocationId: String(hostel._id),
      ...(roomNumber ? { defaultRoomNumber: roomNumber } : {}),
      customerSource: 'staff_telegram',
      createdByStaffId: String(staff._id),
    })
    await SammyCustomerRegistrationAudit.create({
      staffId: String(staff._id), customerId: String(customer._id), idempotencyKey,
      phoneFingerprint: fingerprintSammyRegistrationValue(phone),
      emailFingerprint: fingerprintSammyRegistrationValue(email || 'not-provided'),
      hostelId: String(hostel._id), action: 'customer_created',
    })
    return { created: true as const, customer: await getStaffCustomer(String(customer._id)) }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicates = await User.find({ $or: [{ email }, { 'phones.normalizedNumber': phone }] }).select(CUSTOMER_FIELDS).limit(5).lean()
      return { created: false as const, duplicates: await toCustomerCards(duplicates as unknown as Array<Record<string, unknown>>) }
    }
    throw error
  }
}

export async function updateStaffCustomer(customerId: string, input: { email?: unknown; roomNumber?: unknown; clearRoomNumber?: unknown }, staff: SammyStaff) {
  const fields = Object.keys(input).filter(field => input[field as keyof typeof input] !== undefined)
  if (!fields.length || (fields.includes('email') && fields.length !== 1) || (!fields.includes('email') && fields.some(field => !['roomNumber', 'clearRoomNumber'].includes(field)))) throw new SammyApiError(400, 'INVALID_CUSTOMER_UPDATE', 'Choose one supported customer detail to update.')
  const customer = await getStaffCustomerRecord(customerId) as { _id: Types.ObjectId; email?: string }
  if (fields.includes('email')) {
    const email = String(input.email || '').trim().toLowerCase()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isSyntheticCustomerEmail(email)) throw new SammyApiError(400, 'INVALID_EMAIL', 'Enter a valid customer email address.')
    if (!isSyntheticCustomerEmail(customer.email)) throw new SammyApiError(409, 'EMAIL_CHANGE_REQUIRES_CUSTOMER_CONFIRMATION', 'An existing email can only be changed through the customer’s secure account email-change flow.')
    const owner = await User.findOne({ email }).select('_id').lean()
    if (owner && String(owner._id) !== String(customer._id)) throw new SammyApiError(409, 'EMAIL_ALREADY_REGISTERED', 'That email already belongs to another account.')
    try { await User.updateOne({ _id: customer._id, email: customer.email, emailVerified: false }, { $set: { email, emailVerified: false } }) } catch (error) { if ((error as { code?: number }).code === 11000) throw new SammyApiError(409, 'EMAIL_ALREADY_REGISTERED', 'That email already belongs to another account.'); throw error }
    await SammyCustomerRegistrationAudit.create({ staffId: String(staff._id), customerId: String(customer._id), idempotencyKey: `update-email-${randomUUID()}`, phoneFingerprint: fingerprintSammyRegistrationValue('unchanged'), emailFingerprint: fingerprintSammyRegistrationValue(email), hostelId: 'unchanged', action: 'customer_email_added' })
  } else {
    const clear = input.clearRoomNumber === true; const roomNumber = String(input.roomNumber || '').trim().replace(/\s+/g, ' ')
    if (!clear && (!roomNumber || roomNumber.length > 40)) throw new SammyApiError(400, 'INVALID_ROOM_NUMBER', 'Enter a valid room number.')
    await User.updateOne({ _id: customer._id, isSuspended: { $ne: true } }, clear ? { $unset: { defaultRoomNumber: 1 } } : { $set: { defaultRoomNumber: roomNumber } })
    await SammyCustomerRegistrationAudit.create({ staffId: String(staff._id), customerId: String(customer._id), idempotencyKey: `update-room-${randomUUID()}`, phoneFingerprint: fingerprintSammyRegistrationValue('unchanged'), emailFingerprint: fingerprintSammyRegistrationValue('unchanged'), hostelId: 'unchanged', action: clear ? 'customer_room_cleared' : 'customer_room_updated' })
  }
  return { customer: await getStaffCustomer(customerId) }
}
export async function listStaffRegistrationHostels() {
  await connectDB()
  const hostels = await CampusLocation.find({
    parentLocationId: null, active: true, type: 'hostel',
    'deliveryPolicy.enabled': { $ne: false },
  }).select('_id name type deliveryPolicy').sort({ name: 1 }).lean()
  return hostels.map(hostel => ({
    parentLocationId: String(hostel._id), name: hostel.name, type: hostel.type,
    requiresRoomNumber: hostel.deliveryPolicy?.requiresRoomNumber ?? true,
  }))
}
export type SammyPhoneType = 'alternate' | 'whatsapp'
function phoneOwnershipConditions(number: string) { const lastTen = number.slice(-10); return [{ phone: { $regex: escapeRegex(lastTen) + '$' } }, { 'phones.normalizedNumber': number }] }
export async function getStaffCustomerPhones(customerId: string) {
  const user = await getStaffCustomerRecord(customerId) as { phones?: Array<{ number: string; type: string; verified?: boolean }> }
  return (Array.isArray(user.phones) ? user.phones : []).filter(phone => phone.type !== 'primary').map(phone => ({ number: phone.number, type: phone.type, verified: Boolean(phone.verified) }))
}
export async function checkStaffCustomerPhone(customerId: string, rawNumber: unknown, type: unknown) {
  const number = normalizeCustomerPhone(String(rawNumber || ''))
  if (!number || number.length !== 13) throw new SammyApiError(400, 'INVALID_PHONE', 'Enter a valid Nigerian phone number.')
  if (type !== 'alternate' && type !== 'whatsapp') throw new SammyApiError(400, 'INVALID_PHONE_TYPE', 'Choose Alternate Number or WhatsApp Number.')
  const customer = await getStaffCustomerRecord(customerId) as { _id: Types.ObjectId; phone?: string; phones?: Array<{ normalizedNumber?: string }> }
  const owner = await User.findOne({ $or: phoneOwnershipConditions(number) }).select('_id').lean()
  if (owner && String(owner._id) !== String(customer._id)) return { status: 'conflict' as const, normalizedNumber: number }
  const registration = await WhatsAppRegistration.findOne({ phone: number, status: 'linked', userId: { $exists: true, $ne: '' } }).select('userId').lean()
  if (registration?.userId && String(registration.userId) !== String(customer._id)) return { status: 'conflict' as const, normalizedNumber: number }
  if (String(customer.phone || '').replace(/\D/g, '').endsWith(number.slice(-10)) || (customer.phones || []).some(phone => phone.normalizedNumber === number)) return { status: 'already_saved' as const, normalizedNumber: number }
  return { status: 'available' as const, normalizedNumber: number }
}
export async function addStaffCustomerPhone(customerId: string, rawNumber: unknown, type: unknown, staff: SammyStaff) {
  const checked = await checkStaffCustomerPhone(customerId, rawNumber, type)
  if (checked.status !== 'available') return checked
  const customer = await getStaffCustomerRecord(customerId) as { _id: Types.ObjectId }
  try {
    const updated = await User.findOneAndUpdate({ _id: customer._id, 'phones.normalizedNumber': { $ne: checked.normalizedNumber } }, { $addToSet: { phones: { number: checked.normalizedNumber, normalizedNumber: checked.normalizedNumber, type, verified: false } } }, { new: true })
    if (!updated) return { status: 'already_saved' as const, normalizedNumber: checked.normalizedNumber }
  } catch (error) { if ((error as { code?: number }).code === 11000) return { status: 'conflict' as const, normalizedNumber: checked.normalizedNumber }; throw error }
  await SammyPhoneAudit.create({ customerId: String(customer._id), staffId: String(staff._id), phoneFingerprint: fingerprintSammyPhone(checked.normalizedNumber), phoneType: type, verified: false, action: 'phone_added' })
  return { status: 'added' as const, normalizedNumber: checked.normalizedNumber, verified: false }
}
