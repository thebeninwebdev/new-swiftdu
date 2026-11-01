import { Schema, model, models, type Document } from 'mongoose'

export type GiveawayStatus = 'waiting' | 'live' | 'spinning' | 'finished'
export type GiveawayMode = 'winner' | 'elimination'

export interface GiveawayContestant { id: string; name: string; active: boolean }
export interface GiveawayWinner { contestantId: string; name: string; prize: number | null; round: number }
export interface GiveawayElimination { contestantId: string; name: string; round: number; at: Date }
export interface GiveawaySpin { id: string; winnerId: string; startedAt: number; duration: number; startRotation: number; targetRotation: number; contestantIndex: number; contestantCount: number }

export interface IGiveaway extends Document {
  giveawayId: string
  title: string
  slug: string
  status: GiveawayStatus
  mode: GiveawayMode
  contestants: GiveawayContestant[]
  prizes: number[]
  winners: GiveawayWinner[]
  eliminations: GiveawayElimination[]
  currentPrize: number | null
  currentRound: number
  wheelRotation: number
  spin: GiveawaySpin | null
  lastResult: { contestantId: string; name: string; prize: number | null; outcome: 'eliminated' | 'winner'; round: number } | null
  createdAt: Date
  updatedAt: Date
}

const ContestantSchema = new Schema<GiveawayContestant>({ id: { type: String, required: true }, name: { type: String, required: true }, active: { type: Boolean, default: true } }, { _id: false })
const WinnerSchema = new Schema<GiveawayWinner>({ contestantId: String, name: String, prize: { type: Number, default: null }, round: Number }, { _id: false })
const EliminationSchema = new Schema<GiveawayElimination>({ contestantId: String, name: String, round: Number, at: Date }, { _id: false })
const GiveawaySchema = new Schema<IGiveaway>({
  giveawayId: { type: String, required: true, unique: true, index: true }, title: { type: String, required: true }, slug: { type: String, required: true },
  status: { type: String, enum: ['waiting', 'live', 'spinning', 'finished'], default: 'waiting' },
  mode: { type: String, enum: ['winner', 'elimination'], default: 'winner' }, contestants: { type: [ContestantSchema], default: [] },
  prizes: { type: [Number], default: [1500, 2500, 4000] }, winners: { type: [WinnerSchema], default: [] }, eliminations: { type: [EliminationSchema], default: [] },
  currentPrize: { type: Number, default: 1500 }, currentRound: { type: Number, default: 0 }, wheelRotation: { type: Number, default: 0 }, spin: { type: Schema.Types.Mixed, default: null }, lastResult: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true })

export const Giveaway = models.Giveaway || model<IGiveaway>('Giveaway', GiveawaySchema)
