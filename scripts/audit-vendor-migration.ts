/**
 * Idempotent Phase-1 audit. It never guesses pickup locations.
 * Add --seed to create inactive vendor records for the audited candidates.
 * Run with: npx tsx scripts/audit-vendor-migration.ts [--seed]
 */
import { connectDB } from '@/lib/db'
import { Vendor } from '@/models/vendor'
import CampusLocation from '@/models/campus-location'
import { normalizeVendorName } from '@/lib/vendors'

const candidates: Array<{ name: string; serviceType: 'shopping' | 'restaurant'; knownPickup?: string }> = [
  { name: 'Rita Store', serviceType: 'shopping', knownPickup: 'Cafeteria' },
  { name: 'Sarah Store', serviceType: 'shopping' },
  { name: 'Mummy V', serviceType: 'shopping' },
  { name: 'Akpan Store', serviceType: 'restaurant' },
  { name: "Mama's Kitchen", serviceType: 'restaurant' },
  { name: 'Golley Shop', serviceType: 'restaurant' },
]

async function main() {
  await connectDB()
  const seed = process.argv.includes('--seed')
  for (const candidate of candidates) {
    const existing = await Vendor.findOne({ normalizedName: normalizeVendorName(candidate.name) }).lean()
    if (existing?.pickupParentLocationId) { console.log(`${candidate.name}\nserviceType: ${candidate.serviceType}\npickup: CONFIGURED\nstatus: MAPPED\n`); continue }
    if (candidate.knownPickup) {
      const matches = await CampusLocation.find({ parentLocationId: null, active: true, name: candidate.knownPickup }).select('_id').lean()
      const mapped = matches.length === 1
      if (seed) await Vendor.updateOne({ normalizedName: normalizeVendorName(candidate.name) }, { $setOnInsert: { name: candidate.name, normalizedName: normalizeVendorName(candidate.name), serviceType: candidate.serviceType, pickupParentLocationId: mapped ? matches[0]._id : null, active: false } }, { upsert: true })
      console.log(`${candidate.name}\nserviceType: ${candidate.serviceType}\npickup: ${mapped ? candidate.knownPickup : 'unknown'}\nstatus: ${mapped ? 'MAPPED_CANDIDATE_REQUIRES_ADMIN_CONFIRMATION' : 'REQUIRES_MANUAL_PICKUP_MAPPING'}${seed ? '\nrecord: SEEDED_INACTIVE' : ''}\n`)
    } else {
      if (seed) await Vendor.updateOne({ normalizedName: normalizeVendorName(candidate.name) }, { $setOnInsert: { name: candidate.name, normalizedName: normalizeVendorName(candidate.name), serviceType: candidate.serviceType, pickupParentLocationId: null, active: false } }, { upsert: true })
      console.log(`${candidate.name}\nserviceType: ${candidate.serviceType}\npickup: unknown\nstatus: REQUIRES_MANUAL_PICKUP_MAPPING${seed ? '\nrecord: SEEDED_INACTIVE' : ''}\n`)
    }
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
