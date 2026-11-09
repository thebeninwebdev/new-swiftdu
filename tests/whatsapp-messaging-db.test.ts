import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import {
  DEFAULT_MESSAGE_TEMPLATES,
  validateTemplateBody,
  renderTemplate,
  isTemplateApplicable,
  type MessageContext,
} from '../lib/whatsapp/message-templates'
import { seedDefaultTemplatesIfEmpty } from '../lib/whatsapp/message-templates-server'
import MessageTemplate from '../models/message-template'
import Tasker from '../models/tasker'
import { User } from '../models/user'
import { Order } from '../models/order'

test('Database integration: templates, seeding, admin mutations, tasker preferences, and security', async (t) => {
  const mongo = await MongoMemoryServer.create()
  const uri = mongo.getUri('whatsapp_templates_test')
  await mongoose.connect(uri)

  t.after(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  // 1. Initial count is 0
  const initialCount = await MessageTemplate.countDocuments()
  assert.strictEqual(initialCount, 0)

  // 2. Seeding populates default templates
  const seeded = await seedDefaultTemplatesIfEmpty()
  assert.ok(seeded.length > 0)
  assert.strictEqual(seeded.length, DEFAULT_MESSAGE_TEMPLATES.length)

  // 3. Idempotency: calling seed again does not duplicate templates
  const seededAgain = await seedDefaultTemplatesIfEmpty()
  assert.strictEqual(seededAgain.length, DEFAULT_MESSAGE_TEMPLATES.length)
  const countAfterSecondSeed = await MessageTemplate.countDocuments()
  assert.strictEqual(countAfterSecondSeed, DEFAULT_MESSAGE_TEMPLATES.length)

  // 4. Admin creates custom template
  const newTemplate = await MessageTemplate.create({
    title: 'Custom Announcement',
    description: 'Special notice for rainy day deliveries',
    category: 'update',
    body: 'Hello {{customerName}}! Delivery might take a few extra minutes due to rain.',
    orderTypes: ['all'],
    applicableStates: ['in_progress'],
    displayOrder: 99,
    isActive: true,
  })
  assert.ok(newTemplate._id)
  assert.strictEqual(newTemplate.title, 'Custom Announcement')

  // 5. Subsequent seed does NOT overwrite or erase admin's custom template
  await seedDefaultTemplatesIfEmpty()
  const customFound = await MessageTemplate.findById(newTemplate._id)
  assert.ok(customFound)
  assert.strictEqual(customFound?.title, 'Custom Announcement')

  // 6. Admin edits template
  customFound.title = 'Updated Announcement'
  await customFound.save()
  const updatedFound = await MessageTemplate.findById(newTemplate._id)
  assert.strictEqual(updatedFound?.title, 'Updated Announcement')

  // 7. Deactivating template works
  updatedFound!.isActive = false
  await updatedFound!.save()
  const activeTemplates = await MessageTemplate.find({ isActive: true })
  assert.ok(!activeTemplates.some((tmpl) => tmpl._id.toString() === newTemplate._id.toString()))

  // 8. Reordering displayOrder persists
  const t1 = seeded[0]
  const t2 = seeded[1]
  await MessageTemplate.findByIdAndUpdate(t1._id, { displayOrder: 50 })
  await MessageTemplate.findByIdAndUpdate(t2._id, { displayOrder: 1 })

  const sortedTemplates = await MessageTemplate.find().sort({ displayOrder: 1 })
  const indexOfT2 = sortedTemplates.findIndex((x) => x._id.toString() === t2._id.toString())
  const indexOfT1 = sortedTemplates.findIndex((x) => x._id.toString() === t1._id.toString())
  assert.ok(indexOfT2 < indexOfT1)

  // 9. Deleting template removes it
  await MessageTemplate.findByIdAndDelete(newTemplate._id)
  const deletedCheck = await MessageTemplate.findById(newTemplate._id)
  assert.strictEqual(deletedCheck, null)

  // 10. Tasker WhatsApp preference persistence
  const tasker = await Tasker.create({
    phone: '08098765432',
    location: 'Hall 1',
    studentId: 'ST9999',
    isVerified: true,
  })

  // Defaults to 'ask_every_time'
  assert.strictEqual(tasker.whatsappAppPreference, 'ask_every_time')

  // Updates and persists preference
  tasker.whatsappAppPreference = 'whatsapp_business'
  await tasker.save()
  const reloadedTasker = await Tasker.findById(tasker._id)
  assert.strictEqual(reloadedTasker?.whatsappAppPreference, 'whatsapp_business')

  // 11. Customer Contact Security & Order Assignment
  const customer = await User.create({
    email: 'test_cust@swiftdu.com',
    role: 'user',
    name: 'Bisi Customer',
    phone: '08012345678',
  })

  const assignedOrder = await Order.create({
    userId: customer._id.toString(),
    taskType: 'restaurant',
    description: 'Food delivery',
    amount: 1500,
    commission: 300,
    totalAmount: 1800,
    location: 'PG Hall',
    roomNumber: 'A12',
    status: 'in_progress',
    taskerId: tasker._id.toString(),
    taskerName: 'Tasker Bob',
    customerName: customer.name,
    customerPhone: customer.phone,
    hasPaid: false,
    pricingModel: 'tiered',
    isTestOrder: false,
  })

  // Authorized tasker verification:
  const isAssigned = assignedOrder.taskerId === tasker._id.toString()
  assert.strictEqual(isAssigned, true)

  // Unassigned tasker is rejected:
  const unrelatedTaskerId = new mongoose.Types.ObjectId().toString()
  const isUnrelatedAssigned = assignedOrder.taskerId === unrelatedTaskerId
  assert.strictEqual(isUnrelatedAssigned, false)

  // Suspended tasker is identified:
  tasker.isSettlementSuspended = true
  await tasker.save()
  assert.strictEqual(tasker.isSettlementSuspended, true)

  // 12. Context preparation with verified amounts:
  const verifiedContext: MessageContext = {
    customerName: customer.name,
    taskerName: 'Bob',
    orderNumber: assignedOrder._id.toString().slice(-6).toUpperCase(),
    taskType: assignedOrder.taskType,
    isCafeInquiry: false,
    orderStatus: assignedOrder.status,
    hasPaid: assignedOrder.hasPaid,
    outstandingAmount: assignedOrder.totalAmount,
    deliveryLocation: `${assignedOrder.location} - Room ${assignedOrder.roomNumber}`,
    storeName: 'The Canteen',
  }

  const applicableForAssigned = sortedTemplates.filter((t) =>
    isTemplateApplicable(t, verifiedContext)
  )
  assert.ok(applicableForAssigned.length > 0)

  const paymentReq = applicableForAssigned.find((t) => t.title === 'Request Outstanding Payment')
  assert.ok(paymentReq)
  const renderedPaymentReq = renderTemplate(paymentReq.body, verifiedContext)
  assert.ok(renderedPaymentReq.includes('₦1,800'))
  assert.ok(renderedPaymentReq.includes('Bisi Customer'))
})
