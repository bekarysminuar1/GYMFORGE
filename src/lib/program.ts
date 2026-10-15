import { EXERCISE_BY_ID, EXERCISES } from '../data/exercises'
import type {
  Equipment,
  Exercise,
  Muscle,
  PlannedExercise,
  Profile,
  Program,
  ProgramDay,
  SplitType,
} from './types'

export const SPLIT_LABEL: Record<SplitType, string> = {
  full_body: 'Full Body',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
  bro_split: 'Сплит по мышечным группам',
  custom: 'Пользовательская',
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/** Слот дня: список кандидатов в порядке предпочтения. */
type Slot = string[]

interface DayTemplate {
  name: string
  focus: Muscle[]
  slots: Slot[]
}

const CHEST: Slot = ['chest-press-machine', 'db-bench-press', 'bench-press', 'pushup']
const CHEST2: Slot = ['incline-db-press', 'pec-deck', 'cable-fly']
const VBACK: Slot = ['lat-pulldown', 'pullup']
const HBACK: Slot = ['seated-row-machine', 'cable-row', 'db-row']
const SHOULDER: Slot = ['shoulder-press-machine', 'db-shoulder-press']
const LATERAL: Slot = ['lateral-raise', 'cable-lateral-raise', 'rear-delt-fly', 'face-pull']
const TRI: Slot = ['triceps-pushdown', 'triceps-machine', 'dips']
const BI: Slot = ['cable-curl', 'bicep-curl-db']
const QUAD: Slot = ['leg-press', 'squat-smith', 'back-squat', 'goblet-squat']
const QUAD2: Slot = ['leg-extension', 'goblet-squat']
const HAM: Slot = ['leg-curl', 'romanian-deadlift-db']
const CALF: Slot = ['calf-raise-machine']
const CORE: Slot = ['cable-crunch']
const REAR: Slot = ['face-pull', 'rear-delt-fly']

const TEMPLATES: Record<Exclude<SplitType, 'custom'>, DayTemplate[][]> = {
  full_body: [
    [
      { name: 'Full Body A', focus: ['chest', 'back', 'quads'], slots: [QUAD, CHEST, VBACK, SHOULDER, HAM, CORE] },
      { name: 'Full Body B', focus: ['back', 'chest', 'hamstrings'], slots: [HAM, HBACK, CHEST2, QUAD2, BI, TRI] },
    ],
  ],
  upper_lower: [
    [
      { name: 'Верх A', focus: ['chest', 'back', 'shoulders'], slots: [CHEST, VBACK, SHOULDER, HBACK, BI, TRI] },
      { name: 'Низ A', focus: ['quads', 'hamstrings', 'calves'], slots: [QUAD, HAM, QUAD2, CALF, CORE] },
      { name: 'Верх B', focus: ['back', 'chest', 'shoulders'], slots: [HBACK, CHEST2, LATERAL, VBACK, TRI, BI] },
      { name: 'Низ B', focus: ['hamstrings', 'quads', 'glutes'], slots: [HAM, QUAD, QUAD2, CALF, CORE] },
    ],
  ],
  ppl: [
    [
      { name: 'Push', focus: ['chest', 'shoulders', 'triceps'], slots: [CHEST, SHOULDER, CHEST2, LATERAL, TRI] },
      { name: 'Pull', focus: ['back', 'biceps'], slots: [VBACK, HBACK, REAR, BI] },
      { name: 'Legs', focus: ['quads', 'hamstrings', 'calves'], slots: [QUAD, HAM, QUAD2, CALF, CORE] },
    ],
  ],
  bro_split: [
    [
      { name: 'Грудь', focus: ['chest'], slots: [CHEST, CHEST2, CHEST, TRI] },
      { name: 'Спина', focus: ['back'], slots: [VBACK, HBACK, REAR, BI] },
      { name: 'Ноги', focus: ['quads', 'hamstrings', 'calves'], slots: [QUAD, HAM, QUAD2, CALF] },
      { name: 'Плечи', focus: ['shoulders'], slots: [SHOULDER, LATERAL, REAR, CORE] },
      { name: 'Руки', focus: ['biceps', 'triceps'], slots: [BI, TRI, BI, TRI] },
    ],
  ],
}

export function recommendSplit(p: Pick<Profile, 'daysPerWeek' | 'level'>): SplitType {
  if (p.daysPerWeek <= 3) return p.level === 'advanced' && p.daysPerWeek === 3 ? 'ppl' : 'full_body'
  if (p.daysPerWeek === 4) return 'upper_lower'
  if (p.daysPerWeek === 5) return 'bro_split'
  return 'ppl'
}

const AVAILABLE_ALWAYS: Equipment[] = ['bodyweight']

export function isAllowed(ex: Exercise, p: Pick<Profile, 'equipment' | 'limitations'>): boolean {
  if (ex.equipment === 'cardio') return false
  if (![...p.equipment, ...AVAILABLE_ALWAYS].includes(ex.equipment)) return false
  // при указанных ограничениях не назначаем упражнения, нагружающие эту зону
  return !ex.stresses.some((s) => p.limitations.includes(s))
}

export function dosage(
  ex: Exercise,
  p: Pick<Profile, 'goal' | 'level'>,
): Omit<PlannedExercise, 'exerciseId'> {
  const beginner = p.level === 'beginner'
  const compound = ex.compound
  let sets = compound ? (beginner ? 3 : 4) : 3
  let repMin = compound ? 8 : 10
  let repMax = compound ? 12 : 15
  let restSec = compound ? 120 : 75
  let rir = beginner ? 3 : 2
  if (p.goal === 'strength') {
    if (compound) {
      repMin = 4
      repMax = 6
      restSec = 180
      sets = beginner ? 3 : 4
    } else {
      repMin = 8
      repMax = 12
    }
  } else if (p.goal === 'fat_loss' || p.goal === 'general') {
    repMin = compound ? 10 : 12
    repMax = compound ? 15 : 15
    restSec = compound ? 90 : 60
    sets = 3
  }
  if (beginner && sets > 3) sets = 3
  if (ex.timed) return { sets: 3, repMin: 30, repMax: 60, restSec: 60, rir }
  return { sets, repMin, repMax, restSec, rir }
}

/** Оценка длительности: разминка 5 мин + на подход 40 с работы + отдых. */
export function estimateMinutes(exs: PlannedExercise[]): number {
  const sec = exs.reduce((a, e) => a + e.sets * (40 + e.restSec), 0)
  return Math.round(5 + sec / 60)
}

function pick(slot: Slot, p: Profile, used: Set<string>): string | null {
  const ok = slot.filter((id) => {
    const ex = EXERCISE_BY_ID[id]
    return ex && isAllowed(ex, p) && !used.has(id)
  })
  if (ok.length === 0) return null
  const pref = ok.find((id) => p.preferred.includes(id))
  return pref ?? ok[0]
}

export function generateProgram(profile: Profile, split: SplitType = recommendSplit(profile)): Program {
  const base = TEMPLATES[split === 'custom' ? 'full_body' : split][0]
  const n = profile.daysPerWeek
  const days: ProgramDay[] = []
  for (let i = 0; i < n; i++) {
    const t = base[i % base.length]
    const used = new Set<string>()
    const exercises: PlannedExercise[] = []
    for (const slot of t.slots) {
      const id = pick(slot, profile, used)
      if (!id) continue
      used.add(id)
      exercises.push({ exerciseId: id, ...dosage(EXERCISE_BY_ID[id], profile) })
    }
    // подгоняем под доступное время: убираем с конца (изоляция в конце шаблона)
    while (exercises.length > 3 && estimateMinutes(exercises) > profile.sessionMinutes) exercises.pop()
    const suffix = i >= base.length ? ` ${Math.floor(i / base.length) + 1}` : ''
    days.push({ id: uid(), name: t.name + suffix, focus: t.focus, exercises })
  }
  return {
    id: uid(),
    name: `${SPLIT_LABEL[split === 'custom' ? 'full_body' : split]} · ${n} дн/нед`,
    split,
    days: days.filter((d) => d.exercises.length > 0),
    createdAt: new Date().toISOString(),
  }
}

/** Недельный объём подходов по мышечным группам (основные мышцы). */
export function weeklySets(program: Program): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const d of program.days)
    for (const e of d.exercises) {
      const ex = EXERCISE_BY_ID[e.exerciseId]
      if (!ex) continue
      for (const m of ex.primary) out[m] = (out[m] ?? 0) + e.sets
    }
  return out
}

/** Подходящие замены: из alternatives + того же основного мускула и доступного оборудования. */
export function alternativesFor(exId: string, profile: Pick<Profile, 'equipment' | 'limitations'> | null): Exercise[] {
  const ex = EXERCISE_BY_ID[exId]
  if (!ex) return []
  const ids = new Set(ex.alternatives)
  for (const o of EXERCISES) {
    if (o.id !== ex.id && o.equipment !== 'cardio' && o.primary[0] === ex.primary[0]) ids.add(o.id)
  }
  return [...ids]
    .map((id) => EXERCISE_BY_ID[id])
    .filter((o): o is Exercise => !!o && o.equipment !== 'cardio' && (!profile || isAllowed(o, profile)))
    .slice(0, 8)
}

export function makePlanned(ex: Exercise, profile: Pick<Profile, 'goal' | 'level'> | null): PlannedExercise {
  return { exerciseId: ex.id, ...dosage(ex, profile ?? { goal: 'general', level: 'beginner' }) }
}
