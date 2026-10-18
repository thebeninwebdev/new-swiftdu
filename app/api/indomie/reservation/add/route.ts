import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import { lockTaskerWork } from '@/lib/tasker-work-server'
import { canAssignCapacity } from '@/lib/tasker-capacity'
import { isRunStillBookable } from '@/lib/indomie-runs'
import { calculateOrderPricing } from '@/lib/pricing'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'

/** Adds a meal without ever changing the amount already marked as paid. */
export async function POST(request: NextRequest) {
  await connectDB()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const settings = await getIndomieBatchSettings()
  const parent = await Order.findOne({ _id: body.orderId, userId: session.user.id, taskType: 'indomie' })
  if (!parent || !parent.taskerId || !parent.indomieRunAt) return NextResponse.json({ error: 'Indomie reservation not found.' }, { status: 404 })
  if (!isRunStillBookable(parent.indomieRunAt, new Date(), settings)) return NextResponse.json({ error: 'This run has already closed. Choose the next run.' }, { status: 409, headers: { 'X-Indomie-Next-Run': 'true' } })
  const meal = body.meal
  const packs = Number(meal?.indomiePacks); const eggs = Number(meal?.eggCount); const amount = Number(meal?.amount)
  if (!Number.isInteger(packs) || packs < 1 || !Number.isInteger(eggs) || eggs < 0 || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter a valid meal.' }, { status: 400 })
  const release = await lockTaskerWork(parent.taskerId)
  try {
    const fresh = await Order.findById(parent._id)
    if (!fresh || !fresh.taskerId || !fresh.indomieRunAt || !isRunStillBookable(fresh.indomieRunAt, new Date(), settings)) return NextResponse.json({ error: 'This run is no longer available.' }, { status: 409 })
    if (!await canAssignCapacity(fresh.taskerId, 1)) return NextResponse.json({ error: 'This run no longer has room for another meal. Choose the next run.' }, { status: 409 })
    const pricing = calculateOrderPricing({ amount, taskType: 'indomie', indomiePacks: packs, eggCount: eggs })
    if (!fresh.hasPaid) {
      const meals = [...(fresh.indomieMeals || [{ indomiePacks: fresh.indomiePacks || 1, eggCount: fresh.eggCount || 0, amount: fresh.amount, description: fresh.description }]), { indomiePacks: packs, eggCount: eggs, amount, description: typeof meal.description === 'string' ? meal.description : undefined }]
      if (meals.length > 3) return NextResponse.json({ error: 'This run already has 3 meals in your order.' }, { status: 409 })
      fresh.indomieMeals = meals
      fresh.indomieSlotCount = meals.length
      fresh.indomiePacks = meals.reduce((sum, item) => sum + item.indomiePacks, 0)
      fresh.eggCount = meals.reduce((sum, item) => sum + item.eggCount, 0)
      fresh.amount += pricing.amount; fresh.itemPrice = (fresh.itemPrice || 0) + pricing.amount
      fresh.totalAmount += pricing.totalAmount; fresh.serviceFee += pricing.serviceFee; fresh.commission += pricing.serviceFee
      await fresh.save()
      return NextResponse.json({ order: fresh, addon: false })
    }
    const addon = new Order({
      userId: fresh.userId, taskType: 'indomie', description: typeof meal.description === 'string' ? meal.description : undefined,
      amount: pricing.amount, itemPrice: pricing.amount, commission: pricing.serviceFee, platformFee: pricing.platformFee, taskerFee: pricing.taskerFee, serviceFee: pricing.serviceFee, pricingModel: pricing.pricingModel, totalAmount: pricing.totalAmount,
      location: fresh.location, roomNumber: fresh.roomNumber, indomiePacks: packs, eggCount: eggs, indomieMeals: [{ indomiePacks: packs, eggCount: eggs, amount, description: typeof meal.description === 'string' ? meal.description : undefined }], indomieSlotCount: 1,
      indomieRunAt: fresh.indomieRunAt, scheduledFor: fresh.indomieRunAt, indomieRunStatus: 'reserved', indomieReservationGroupId: fresh.indomieReservationGroupId || String(fresh._id), indomieParentOrderId: String(fresh._id), isIndomieAddon: true,
      status: 'in_progress', taskerId: fresh.taskerId, taskerName: fresh.taskerName, acceptedBy: fresh.acceptedBy, paymentProvider: 'manual_transfer', paymentStatus: 'unpaid', settlementStatus: 'not_due', isTestOrder: fresh.isTestOrder, createdInMode: fresh.createdInMode,
    })
    await addon.save()
    return NextResponse.json({ order: addon, addon: true }, { status: 201 })
  } finally { await release() }
}
