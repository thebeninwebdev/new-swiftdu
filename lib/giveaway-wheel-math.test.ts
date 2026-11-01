import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SPIN_DURATION,
  ELIMINATION_SPIN_DURATION,
  FULL_SPIN_REVOLUTIONS,
  SECOND_PRIZE_SPIN_DURATION,
  landingCenter,
  spinDuration,
  targetRotation,
} from './giveaway-wheel-math'

test('every contestant lands by its center beneath the pointer for 2 through 8 contestants', () => {
  for (let count = 2; count <= 8; count += 1) {
    for (let index = 0; index < count; index += 1) {
      for (const start of [0, 137.25, 2_284, 4_716.5]) {
        const target = targetRotation(start, index, count)
        assert.ok(Math.abs(landingCenter(target, index, count)) < 1e-9, `${count} contestants, index ${index}, start ${start}`)
        const revolutions = (target - start) / 360
        assert.ok(revolutions >= FULL_SPIN_REVOLUTIONS && revolutions < FULL_SPIN_REVOLUTIONS + 1)
      }
    }
  }
})
test('spin timing follows the elimination and prize defaults', () => {
  assert.equal(spinDuration('elimination', 8, null), ELIMINATION_SPIN_DURATION)
  assert.equal(spinDuration('elimination', 3, 1_500), DEFAULT_SPIN_DURATION)
  assert.equal(spinDuration('winner', 8, 1_500), DEFAULT_SPIN_DURATION)
  assert.equal(spinDuration('winner', 8, 2_500), SECOND_PRIZE_SPIN_DURATION)
  assert.equal(spinDuration('winner', 8, 4_000), SECOND_PRIZE_SPIN_DURATION)
})
