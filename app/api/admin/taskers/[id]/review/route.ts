import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { reviewTaskerApplication, type ApplicationReview } from '@/lib/tasker-application-review'

type ReviewSummary = { summary: string; highlights: string[]; concerns: string[]; thingsToVerify: string[] }

function deterministicSummary(review: ApplicationReview): ReviewSummary {
  const valid = review.checks.filter((check) => check.status === 'valid').map((check) => check.message)
  const concerns = review.checks.filter((check) => check.status !== 'valid').map((check) => check.message)
  return {
    summary: concerns.length ? `Application has ${concerns.length} item${concerns.length === 1 ? '' : 's'} requiring verification.` : 'Application information is complete and consistently formatted.',
    highlights: valid,
    concerns,
    thingsToVerify: concerns,
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  await connectDB()
  const { id } = await params
  const tasker = await Tasker.findById(id).lean()
  if (!tasker) return NextResponse.json({ error: 'Tasker not found.' }, { status: 404 })
  const review = reviewTaskerApplication({ name: tasker.fullName, email: tasker.email, phone: tasker.phone, location: tasker.location, studentId: tasker.studentId, level: tasker.level, availability: tasker.availability, motivation: tasker.motivation, motivationOther: tasker.motivationOther })
  const summary = deterministicSummary(review)
  return NextResponse.json({ review, summary, source: 'deterministic' })
}
