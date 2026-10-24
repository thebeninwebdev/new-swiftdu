/**
 * Reports User <-> Tasker identity inconsistencies. It is dry-run by default;
 * pass --apply to repair only relationships that the runtime reconciler can
 * prove are safe. Nothing is deleted or merged.
 */
import { connectDB } from '@/lib/db'
import { normalizeEmail } from '@/lib/email-normalization'
import { reconcileTaskerIdentityForUser } from '@/lib/tasker-onboarding'
import Tasker from '@/models/tasker'
import { User } from '@/models/user'

const apply = process.argv.includes('--apply')

async function main() {
  await connectDB()
  const taskers = await Tasker.find({}).select('_id email userId isRejected').lean()
  let safe = 0
  let conflicts = 0

  for (const tasker of taskers) {
    const email = normalizeEmail(tasker.email)
    const linkedUser = tasker.userId ? await User.findById(tasker.userId).select('_id email role taskerId').lean() : null
    const emailUser = !linkedUser && email ? await User.findOne({ email }).select('_id email role taskerId').lean() : null
    const user = linkedUser || emailUser
    if (!user) continue

    const sameTasker = String(user.taskerId || '') === String(tasker._id)
    const linkMatches = !tasker.userId || String(tasker.userId) === String(user._id)
    const emailMatches = normalizeEmail(user.email) === email
    const needsRepair = linkMatches && emailMatches && !tasker.isRejected && (!sameTasker || user.role !== 'tasker' || !tasker.userId)
    const kind = tasker.userId ? 'Type B' : sameTasker ? 'Type C' : 'Type A'

    if (!needsRepair) {
      if (!linkMatches || !emailMatches || (user.taskerId && !sameTasker)) {
        conflicts += 1
        console.warn(`[CONFLICT] ${tasker._id} ${kind}: requires manual review`)
      }
      continue
    }

    safe += 1
    console.info(`[SAFE ${apply ? 'APPLY' : 'DRY-RUN'}] ${tasker._id} ${kind} -> user ${user._id}`)
    if (apply) {
      try {
        await reconcileTaskerIdentityForUser(String(user._id))
      } catch (error) {
        conflicts += 1
        console.warn(`[CONFLICT] ${tasker._id}: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
  }

  console.info(`Completed ${apply ? 'apply' : 'dry-run'}: ${safe} safe candidate(s), ${conflicts} conflict(s).`)
}

void main().catch((error) => {
  console.error('Tasker account-link audit failed:', error)
  process.exitCode = 1
})
