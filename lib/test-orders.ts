export type TaskerMode = 'training' | 'live'
export type CreatedInMode = 'test' | 'live'

const NON_TEST_ORDER_MATCH = {
  $or: [{ isTestOrder: false }, { isTestOrder: { $exists: false } }],
}

export function isExcoAccount(user?: {
  isExco?: boolean | null
  excoRole?: string | null
}) {
  return Boolean(user?.isExco || user?.excoRole)
}

export function shouldCreateTestOrder(user?: {
  isExco?: boolean | null
  excoRole?: string | null
  testOrderMode?: boolean | null
}) {
  return isExcoAccount(user) && user?.testOrderMode === true
}

export function getTaskerMode(tasker?: {
  taskerMode?: string | null
  isVerified?: boolean | null
}): TaskerMode {
  if (tasker?.taskerMode === 'training' || tasker?.taskerMode === 'live') {
    return tasker.taskerMode
  }

  return tasker?.isVerified ? 'live' : 'training'
}

export function getTaskerOrderModeFilter(tasker?: {
  taskerMode?: string | null
  isVerified?: boolean | null
}) {
  return getTaskerMode(tasker) === 'training'
    ? { isTestOrder: true }
    : NON_TEST_ORDER_MATCH
}

export function shouldSendOrderNotification(order?: {
  isTestOrder?: boolean | null
}) {
  return order?.isTestOrder !== true
}

export function getCreatedInMode(isTestOrder: boolean): CreatedInMode {
  return isTestOrder ? 'test' : 'live'
}
