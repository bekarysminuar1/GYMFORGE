import { best1RM, epley1RM, sessionVolume, setVolume } from './calc'
import { EXERCISE_BY_ID } from '../data/exercises'
import type { LoggedSet, Muscle, Program, WorkoutSession } from './types'

export type Metric = 'weight' | 'oneRm' | 'volume' | 'reps'
export type Range = '30D' | '3M' | '1Y' | 'All'

const DAY = 86400000

export const finishedSessions = (sessions: WorkoutSession[]) =>
  sessions.filter((s) => s.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt))

/** Локальная дата в формате YYYY-MM-DD (без сдвига по UTC). */
export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${dd}`
}

/** Понедельник недели, к которой относится дата (00:00 локального времени). */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

export function weekDays(d: Date): Date[] {
  const s = weekStart(d)
  return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i))
}

export function sessionsInWeek(sessions: WorkoutSession[], d: Date) {
  const start = weekStart(d).getTime()
  return finishedSessions(sessions).filter((s) => {
    const t = new Date(s.startedAt).getTime()
    return t >= start && t < start + 7 * DAY
  })
}

export interface SeriesPoint {
  date: string
  ts: number
  value: number
  sessionId: string
  /** Является ли точка личным рекордом на момент выполнения */
  pr: boolean
}

/** Значение метрики за сессию по упражнению; null, если корректно посчитать нельзя. */
export function metricForSets(sets: LoggedSet[], metric: Metric): number | null {
  if (sets.length === 0) return null
  switch (metric) {
    case 'weight':
      return Math.max(...sets.map((s) => s.weight))
    case 'reps':
      return Math.max(...sets.map((s) => s.reps))
    case 'volume':
      return sets.reduce((a, s) => a + setVolume(s), 0)
    case 'oneRm': {
      const v = best1RM(sets)
      return v === null ? null : Math.round(v * 10) / 10
    }
  }
}

export function exerciseSeries(sessions: WorkoutSession[], exerciseId: string, metric: Metric): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let best = -Infinity
  for (const s of finishedSessions(sessions)) {
    const sets = s.sets.filter((x) => x.exerciseId === exerciseId)
    const v = metricForSets(sets, metric)
    if (v === null) continue
    const pr = best !== -Infinity && v > best
    if (v > best) best = v
    out.push({ date: dayKey(s.startedAt), ts: new Date(s.startedAt).getTime(), value: v, sessionId: s.id, pr })
  }
  return out
}

export function rangeStart(range: Range, now = new Date()): number {
  if (range === 'All') return 0
  const days = range === '30D' ? 30 : range === '3M' ? 91 : 365
  return now.getTime() - days * DAY
}

export function inRange<T extends { ts: number }>(pts: T[], range: Range, now = new Date()): T[] {
  const from = rangeStart(range, now)
  return pts.filter((p) => p.ts >= from)
}

export interface PersonalRecord {
  kind: 'weight' | 'oneRm' | 'volume'
  value: number
  set: LoggedSet
  date: string
}

/** Личные рекорды по упражнению: максимальный вес (при ≥1 повторении), 1RM и объём подхода. */
export function personalRecords(sessions: WorkoutSession[], exerciseId: string): PersonalRecord[] {
  let w: PersonalRecord | null = null
  let r: PersonalRecord | null = null
  let v: PersonalRecord | null = null
  for (const s of finishedSessions(sessions)) {
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId) continue
      const date = dayKey(s.startedAt)
      if (!w || set.weight > w.value || (set.weight === w.value && set.reps > w.set.reps))
        w = { kind: 'weight', value: set.weight, set, date }
      const e = set.reps <= 12 ? epley1RM(set.weight, set.reps) : 0
      if (e > 0 && (!r || e > r.value)) r = { kind: 'oneRm', value: Math.round(e * 10) / 10, set, date }
      const vol = setVolume(set)
      if (!v || vol > v.value) v = { kind: 'volume', value: vol, set, date }
    }
  }
  return [w, r, v].filter((x): x is PersonalRecord => !!x && x.value > 0)
}

/** Какие упражнения в сессии побили рекорд (по весу или 1RM) относительно всех предыдущих сессий. */
export function prsInSession(all: WorkoutSession[], session: WorkoutSession): { exerciseId: string; kind: 'weight' | 'oneRm'; value: number }[] {
  const prev = finishedSessions(all).filter((s) => s.id !== session.id && s.startedAt < session.startedAt)
  const out: { exerciseId: string; kind: 'weight' | 'oneRm'; value: number }[] = []
  const ids = [...new Set(session.sets.map((s) => s.exerciseId))]
  for (const id of ids) {
    const prevSets = prev.flatMap((s) => s.sets.filter((x) => x.exerciseId === id))
    if (prevSets.length === 0) continue // первое выполнение — не рекорд, а точка отсчёта
    const cur = session.sets.filter((x) => x.exerciseId === id)
    const pw = Math.max(...prevSets.map((x) => x.weight))
    const cw = Math.max(...cur.map((x) => x.weight))
    const p1 = best1RM(prevSets) ?? 0
    const c1 = best1RM(cur) ?? 0
    if (cw > pw) out.push({ exerciseId: id, kind: 'weight', value: cw })
    else if (c1 > p1 + 0.05) out.push({ exerciseId: id, kind: 'oneRm', value: Math.round(c1 * 10) / 10 })
  }
  return out
}

/** Объём (кг×повт) по неделям за последние n недель, включая текущую. */
export function weeklyVolume(sessions: WorkoutSession[], weeks: number, now = new Date()) {
  const cur = weekStart(now)
  const out: { label: string; start: number; volume: number; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - i * 7)
    const list = sessionsInWeek(sessions, start)
    out.push({
      label: `${String(start.getDate()).padStart(2, '0')}.${String(start.getMonth() + 1).padStart(2, '0')}`,
      start: start.getTime(),
      volume: Math.round(list.reduce((a, s) => a + sessionVolume(s), 0)),
      count: list.length,
    })
  }
  return out
}

/** Подходов по основным мышцам за период. */
export function muscleSets(sessions: WorkoutSession[], range: Range, now = new Date()): Partial<Record<Muscle, number>> {
  const from = rangeStart(range, now)
  const out: Partial<Record<Muscle, number>> = {}
  for (const s of finishedSessions(sessions)) {
    if (new Date(s.startedAt).getTime() < from) continue
    for (const set of s.sets) {
      const ex = EXERCISE_BY_ID[set.exerciseId]
      if (!ex) continue
      for (const m of ex.primary) out[m] = (out[m] ?? 0) + 1
    }
  }
  return out
}

/** Выполнение плана за последние n недель: сессий / запланированных дней в неделю (не больше 100%). */
export function adherence(sessions: WorkoutSession[], program: Program | null, weeks: number, now = new Date()) {
  if (!program || program.days.length === 0) return null
  const planned = program.days.length * weeks
  const cur = weekStart(now)
  const from = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - (weeks - 1) * 7).getTime()
  let done = 0
  for (let i = 0; i < weeks; i++) {
    const start = new Date(from + i * 7 * DAY)
    done += Math.min(sessionsInWeek(sessions, start).length, program.days.length)
  }
  return { done, planned, ratio: Math.min(1, done / planned) }
}

/** Следующий день программы: после последней завершённой тренировки по циклу. */
export function nextDayIndex(sessions: WorkoutSession[], program: Program | null): number {
  if (!program || program.days.length === 0) return 0
  const last = [...finishedSessions(sessions)].reverse().find((s) => s.programId === program.id)
  if (!last) return 0
  const idx = program.days.findIndex((d) => d.id === last.dayId)
  return idx < 0 ? 0 : (idx + 1) % program.days.length
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export function shortDate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`
}
export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function formatKg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}
export function formatVolume(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1).replace('.', ',')} т` : `${Math.round(n)} кг`
}
