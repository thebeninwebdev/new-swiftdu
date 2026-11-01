export const RESULT_REVEAL_DELAY = 650
export const ELIMINATION_SPIN_DURATION = 8_000
export const DEFAULT_SPIN_DURATION = 9_000
export const SECOND_PRIZE_SPIN_DURATION = 10_000
export const FULL_SPIN_REVOLUTIONS = 6

function normalizedDegrees(value: number) {
  const normalized = ((value % 360) + 360) % 360
  return 360 - normalized < 1e-9 ? 0 : normalized
}

export function spinDuration(mode: 'winner' | 'elimination', contestantCount: number, prize: number | null) {
  if (mode === 'elimination' && contestantCount > 3) return ELIMINATION_SPIN_DURATION
  if (prize != null && prize >= 2_500) return SECOND_PRIZE_SPIN_DURATION
  return DEFAULT_SPIN_DURATION
}

/**
 * SVG sector zero begins at 12 o'clock and sectors proceed clockwise. Rotating
 * by the negative sector-center angle therefore puts the selected center back
 * beneath the fixed 12 o'clock pointer.
 */
export function targetRotation(startRotation: number, selectedIndex: number, contestantCount: number) {
  if (!Number.isInteger(contestantCount) || contestantCount < 2) throw new Error('A wheel needs at least two contestants.')
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= contestantCount) throw new Error('Invalid selected contestant index.')

  const segmentAngle = 360 / contestantCount
  const selectedCenter = (selectedIndex + .5) * segmentAngle
  const landingRotation = normalizedDegrees(-selectedCenter)
  const alignment = normalizedDegrees(landingRotation - normalizedDegrees(startRotation))
  return startRotation + FULL_SPIN_REVOLUTIONS * 360 + alignment
}

export function landingCenter(rotation: number, selectedIndex: number, contestantCount: number) {
  const segmentAngle = 360 / contestantCount
  return normalizedDegrees(rotation + (selectedIndex + .5) * segmentAngle)
}
