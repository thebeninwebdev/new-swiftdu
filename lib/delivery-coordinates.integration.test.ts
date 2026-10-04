
import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Order } from '../models/order'

test('MongoDB preserves raw observations while normal and lean queries hide coordinates', { timeout: 120000 }, async () => {
  const database = await MongoMemoryServer.create()
  try {
    await mongoose.connect(database.getUri(), { dbName: 'delivery-location-test' })
    const order = await Order.create({ userId: 'customer', taskerId: 'tasker', taskType: 'restaurant', location: 'Amnesty Hostel', roomNumber: 'A12', amount: 1, commission: 1, totalAmount: 2, status: 'in_progress' })
    const point = { latitude: 5.1, longitude: 5.2, accuracy: 12, capturedAt: new Date() }
    await Order.findOneAndUpdate({ _id: order._id, status: 'in_progress' }, { $set: { status: 'completed', deliveryCoordinates: point } }, { runValidators: true })
    const raw = await Order.collection.findOne({ _id: order._id })
    assert.equal(raw?.deliveryCoordinates.latitude, 5.1)
    assert.equal(raw?.deliveryDestinationKey, 'amnesty')
    assert.equal(raw?.roomNumber, 'A12')
    assert.equal((await Order.findById(order._id).lean())?.deliveryCoordinates, undefined)
    const authorized = await Order.findById(order._id).select('+deliveryCoordinates').orFail()
    assert.equal(authorized.deliveryCoordinates?.latitude, 5.1)
    assert.equal(authorized.toJSON().deliveryCoordinates, undefined)
    await assert.rejects(Order.findByIdAndUpdate(order._id, { $set: { deliveryCoordinates: { ...point, latitude: 100 } } }, { runValidators: true }))
  } finally {
    await mongoose.disconnect()
    await database.stop()
  }
})

