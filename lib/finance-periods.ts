import type { IAcademicSession, IAcademicSemester } from '@/models/academic-session'
import { AcademicSession } from '@/models/academic-session'
export const FINANCE_TIME_ZONE = 'Africa/Lagos'
export type DateRange = { startDate: Date; endDate: Date }
export function normalizePeriodDate(value: unknown, end = false) { const text = String(value || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Enter a valid date.'); const [year, month, day] = text.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day, end ? 22 : -1, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)) }
export function rangesOverlap(a: DateRange, b: DateRange) { return a.startDate <= b.endDate && b.startDate <= a.endDate }
export function validateAcademicSession(input: Pick<IAcademicSession, 'name' | 'startDate' | 'endDate' | 'semesters'>) { if (!input.name.trim()) throw new Error('Session name is required.'); if (input.startDate >= input.endDate) throw new Error('Session start date must be before its end date.'); for (const semester of input.semesters) { if (!semester.name.trim()) throw new Error('Semester name is required.'); if (semester.startDate >= semester.endDate) throw new Error(`${semester.name} start date must be before its end date.`); if (semester.startDate < input.startDate || semester.endDate > input.endDate) throw new Error(`${semester.name} must be inside the session date range.`) } for (let index = 0; index < input.semesters.length; index += 1) for (let other = index + 1; other < input.semesters.length; other += 1) if (rangesOverlap(input.semesters[index], input.semesters[other])) throw new Error(`${input.semesters[index].name} overlaps with ${input.semesters[other].name}.`) }
export function getCurrentAcademicSession(sessions: IAcademicSession[], now = new Date()) { return sessions.find(session => session.startDate <= now && now <= session.endDate) || null }
export function getCurrentSemester(session: IAcademicSession, now = new Date()) { return session.semesters.find(semester => semester.startDate <= now && now <= semester.endDate) || null }
export function getFinancePeriodRange(session: IAcademicSession, semesterId?: string | null): DateRange { if (!semesterId) return { startDate: session.startDate, endDate: session.endDate }; const semester = session.semesters.find(item => String(item._id) === semesterId); if (!semester) throw new Error('Semester not found in this session.'); return semester }

export type FinancePeriod = { mode: 'all-time' | 'session' | 'semester'; label: string; sessionId?: string; semesterId?: string; startDate?: Date; endDate?: Date }
/** Central reporting-period resolver. Historical documents remain assigned by timestamps. */
export async function resolveFinancePeriod(input: { sessionId?: string | null; semesterId?: string | null; allTime?: boolean }) : Promise<FinancePeriod> {
  if (input.allTime) return { mode: 'all-time', label: 'All Time' }
  const session = input.sessionId ? await AcademicSession.findById(input.sessionId).lean() : await AcademicSession.findOne({ isActive: true }).lean()
  if (!session) return { mode: 'all-time', label: 'All Time' }
  const range = getFinancePeriodRange(session, input.semesterId)
  const semester = input.semesterId ? session.semesters.find(item => String(item._id) === input.semesterId) : undefined
  return { mode: semester ? 'semester' : 'session', sessionId: String(session._id), semesterId: semester ? String(semester._id) : undefined, label: semester ? `${session.name} / ${semester.name}` : session.name, ...range }
}
export function buildCreatedAtPeriodMatch(period: FinancePeriod) { return period.startDate && period.endDate ? { createdAt: { $gte: period.startDate, $lte: period.endDate } } : {} }
