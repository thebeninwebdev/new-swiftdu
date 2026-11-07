import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

test('staff registration validates, prevents duplicates, persists location, and is idempotent', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryServer.create()
  process.env.MONGODB_URI = database.getUri('sammy-staff-registration')
  await mongoose.connect(process.env.MONGODB_URI)
  const { User } = await import('@/models/user')
  const { default: CampusLocation } = await import('@/models/campus-location')
  const { WhatsAppRegistration } = await import('@/models/whatsapp-registration')
  const { SammyCustomerRegistrationAudit } = await import('@/models/sammy-customer-registration-audit')
  const { createStaffCustomer, listStaffRegistrationHostels, resolveSammyStaff } = await import('./staff')
  t.after(async () => {
    await mongoose.disconnect()
    await database.stop()
  })

  const staffId = new mongoose.Types.ObjectId()
  const staff = { _id: staffId, email: 'staff@example.com', role: 'admin', telegramUserId: '12345' }
  const hostel = await CampusLocation.create({
    name: 'Unity Hostel', normalizedName: 'unity hostel', type: 'hostel', active: true,
    coordinates: { latitude: 6.1, longitude: 7.2, capturedAt: new Date() },
    deliveryPolicy: { enabled: true, requiresRoomNumber: true }, createdBy: String(staffId),
  })
  await CampusLocation.create({
    name: 'Lecture Hall', normalizedName: 'lecture hall', type: 'building', active: true,
    coordinates: { latitude: 6.2, longitude: 7.3, capturedAt: new Date() }, createdBy: String(staffId),
  })
  assert.deepEqual((await listStaffRegistrationHostels()).map(item => item.name), ['Unity Hostel'])

  const base = {
    name: ' Ada   Nwosu ',
    phone: '0801 234 5678', email: ' NEW.Customer@Example.com ',
    parentLocationId: String(hostel._id), roomNumber: ' B12 ', idempotencyKey: 'registration-attempt-0001',
  }
  const created = await createStaffCustomer(base, staff as never)
  assert.equal(created.created, true)
  if (!created.created) return
  const saved = await User.findById(created.customer.id).lean()
  assert.equal(saved?.name, 'Ada Nwosu')
  assert.equal(created.customer.name, 'Ada Nwosu')
  assert.equal(saved?.phone, '2348012345678')
  assert.equal(saved?.email, 'new.customer@example.com')
  assert.equal(saved?.emailVerified, false)
  assert.equal(saved?.password, undefined)
  assert.equal(saved?.role, 'user')
  assert.equal(saved?.defaultLocation, 'Unity Hostel')
  assert.equal(saved?.defaultLocationId, String(hostel._id))
  assert.equal(saved?.defaultRoomNumber, 'B12')
  assert.equal(saved?.createdByStaffId, String(staffId))
  assert.equal(saved?.phones?.[0]?.verified, false)

  const { searchStaffCustomers } = await import('./staff')
  const byName = await searchStaffCustomers('ada nwosu')
  assert.equal(byName[0]?.id, created.customer.id)
  assert.equal(byName[0]?.name, 'Ada Nwosu')

  const repeated = await createStaffCustomer(base, staff as never)
  assert.equal(repeated.created, true)
  assert.equal(repeated.created && repeated.customer.id, created.customer.id)
  assert.equal(await User.countDocuments({ email: 'new.customer@example.com' }), 1)
  const audit = await SammyCustomerRegistrationAudit.findOne({ customerId: created.customer.id }).lean()
  assert.equal(audit?.staffId, String(staffId))
  assert.equal('phone' in (audit || {}), false)
  assert.equal('email' in (audit || {}), false)

  const duplicatePhone = await createStaffCustomer({ ...base, email: 'other@example.com', idempotencyKey: 'registration-attempt-0002' }, staff as never)
  assert.equal(duplicatePhone.created, false)
  const duplicateEmail = await createStaffCustomer({ ...base, phone: '08022222222', idempotencyKey: 'registration-attempt-0003' }, staff as never)
  assert.equal(duplicateEmail.created, false)

  const whatsappOwner = await User.create({ email: 'whatsapp@example.com', role: 'user' })
  await WhatsAppRegistration.create({ phone: '2348033333333', userId: String(whatsappOwner._id), token: 'whatsapp-token', status: 'pending' })
  const duplicateWhatsapp = await createStaffCustomer({
    ...base, phone: '08033333333', email: 'fresh@example.com', idempotencyKey: 'registration-attempt-0004',
  }, staff as never)
  assert.equal(duplicateWhatsapp.created, false)

  await assert.rejects(
    createStaffCustomer({ ...base, name: 'Ada', idempotencyKey: 'registration-attempt-name' }, staff as never),
    (error: unknown) => (error as { code?: string }).code === 'INVALID_NAME'
  )
  await assert.rejects(
    createStaffCustomer({ ...base, phone: '123', idempotencyKey: 'registration-attempt-0005' }, staff as never),
    (error: unknown) => (error as { code?: string }).code === 'INVALID_PHONE'
  )

  await SammyCustomerRegistrationAudit.insertMany(Array.from({ length: 19 }, (_, index) => ({
    staffId: String(staffId), customerId: new mongoose.Types.ObjectId().toString(),
    idempotencyKey: `rate-limit-${index.toString().padStart(20, '0')}`,
    phoneFingerprint: 'phone', emailFingerprint: 'email', hostelId: String(hostel._id), action: 'customer_created',
  })))
  await assert.rejects(
    createStaffCustomer({ ...base, phone: '08044444444', email: 'rate@example.com', idempotencyKey: 'registration-attempt-rate' }, staff as never),
    (error: unknown) => (error as { code?: string }).code === 'CUSTOMER_CREATION_RATE_LIMITED'
  )
  await assert.rejects(
    createStaffCustomer({ ...base, email: 'not-an-email', idempotencyKey: 'registration-attempt-0006' }, staff as never),
    (error: unknown) => (error as { code?: string }).code === 'INVALID_EMAIL'
  )

  await User.create({ email: 'customer-staff@example.com', role: 'user', telegramUserId: '99999', telegramEnabled: true })
  await assert.rejects(
    resolveSammyStaff({ id: '99999' }),
    (error: unknown) => (error as { code?: string }).code === 'STAFF_INSUFFICIENT_PRIVILEGES'
  )
})
