import { waitUntil } from '@vercel/functions'

export type OrderCreationBackgroundChannel = 'realtime' | 'push' | 'telegram'

export type OrderCreationBackgroundJob = {
  channel: OrderCreationBackgroundChannel
  run: () => Promise<unknown> | unknown
}

type BackgroundLogger = Pick<Console, 'info' | 'error'>
type BackgroundScheduler = (promise: Promise<unknown>) => void | undefined

type PersistThenScheduleInput<T> = {
  persist: () => Promise<T>
  getOrderId: (persisted: T) => string
  createJobs: (persisted: T) => OrderCreationBackgroundJob[]
  schedule?: BackgroundScheduler
  logger?: BackgroundLogger
  now?: () => number
}

function elapsedMs(startedAt: number, now: () => number) {
  return Math.round((now() - startedAt) * 100) / 100
}

function conciseError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function runOrderCreationBackgroundJobs({
  orderId,
  jobs,
  logger = console,
  now = performance.now.bind(performance),
}: {
  orderId: string
  jobs: OrderCreationBackgroundJob[]
  logger?: BackgroundLogger
  now?: () => number
}) {
  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const startedAt = now()
      try {
        return await job.run()
      } finally {
        logger.info('[Orders POST Notification Timing]', {
          orderId,
          channel: job.channel,
          [`ORDER_NOTIFY_${job.channel.toUpperCase()}_MS`]: elapsedMs(startedAt, now),
        })
      }
    })
  )

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error('[Orders POST Notification Error]', {
        orderId,
        channel: jobs[index].channel,
        error: conciseError(result.reason),
      })
    }
  })

  return results
}

/**
 * The persisted value is returned as soon as its background promise has been
 * registered. Only a successful commit can reach createJobs or waitUntil.
 */
export async function persistThenScheduleOrderCreation<T>({
  persist,
  getOrderId,
  createJobs,
  schedule = waitUntil,
  logger = console,
  now = performance.now.bind(performance),
}: PersistThenScheduleInput<T>) {
  const persisted = await persist()
  const orderId = getOrderId(persisted)

  try {
    const jobs = createJobs(persisted)
    const backgroundWork = Promise.resolve().then(() =>
      runOrderCreationBackgroundJobs({ orderId, jobs, logger, now })
    )
    schedule(backgroundWork)
  } catch (error) {
    // Scheduling must never rewrite a successful database outcome as a 500.
    logger.error('[Orders POST Notification Scheduling Error]', {
      orderId,
      error: conciseError(error),
    })
  }

  return persisted
}
