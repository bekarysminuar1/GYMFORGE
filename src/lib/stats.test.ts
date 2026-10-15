import { describe, expect, it } from 'vitest'
import {
  adherence,
  exerciseSeries,
  inRange,
  nextDayIndex,
  personalRecords,
  prsInSession,
  weekDays,
  weekStart,
  weeklyVolume,
} from './stats'
import type { LoggedSet, Program, WorkoutSession } from './types'

let n = 0
const set = (exerciseId: string, weight: number, reps: number, rir = 2): LoggedSet => ({
  id: `s${n++}`,
  exerciseId,
  setIndex: 0,
  weight,
  reps,
  rir,
  at: '',
})
const session = (id: string, iso: string, sets: LoggedSet[], dayId = 'd1'): WorkoutSession => ({
  id,
  programId: 'p',
  dayId,
  dayName: dayId,
  startedAt: iso,
  finishedAt: iso,
  exercises: [],
  sets,
  flags: {},
})

const program = { id: 'p', name: 'x', split: 'full_body', createdAt: '', days: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }] } as unknown as Program

describe('weeks', () => {
  it('weekStart returns Monday', () => {
    const wed = new Date(2026, 9, 14) // 14 окт 2026 — среда
    const s = weekStart(wed)
    expect(s.getDay()).toBe(1)
    expect(s.getDate()).toBe(12)
    expect(weekDays(wed)).toHaveLength(7)
  })
})

describe('exerciseSeries', () => {
  const s1 = session('a', '2026-09-01T10:00:00', [set('x', 50, 10), set('x', 50, 8)])
  const s2 = session('b', '2026-09-05T10:00:00', [set('x', 55, 8)])
  const s3 = session('c', '2026-09-09T10:00:00', [set('x', 50, 10)])
  it('takes the best value per session and marks PRs', () => {
    const pts = exerciseSeries([s3, s1, s2], 'x', 'weight')
    expect(pts.map((p) => p.value)).toEqual([50, 55, 50])
    expect(pts.map((p) => p.pr)).toEqual([false, true, false])
  })
  it('skips 1RM for sets above 12 reps (not reliable)', () => {
    const s = session('z', '2026-09-10T10:00:00', [set('x', 20, 20)])
    expect(exerciseSeries([s], 'x', 'oneRm')).toHaveLength(0)
  })
  it('filters by range', () => {
    const pts = exerciseSeries([s1, s2, s3], 'x', 'weight')
    expect(inRange(pts, '30D', new Date('2026-09-12T00:00:00'))).toHaveLength(3)
    expect(inRange(pts, '30D', new Date('2026-12-12T00:00:00'))).toHaveLength(0)
    expect(inRange(pts, 'All', new Date('2030-01-01'))).toHaveLength(3)
  })
})

describe('records', () => {
  it('finds best weight, 1RM and set volume', () => {
    const s1 = session('a', '2026-09-01T10:00:00', [set('x', 50, 10)])
    const s2 = session('b', '2026-09-05T10:00:00', [set('x', 60, 5)])
    const recs = personalRecords([s1, s2], 'x')
    expect(recs.find((r) => r.kind === 'weight')?.value).toBe(60)
    expect(recs.find((r) => r.kind === 'oneRm')?.value).toBe(70)
    expect(recs.find((r) => r.kind === 'volume')?.value).toBe(500)
  })
  it('first performance is not a PR', () => {
    const s1 = session('a', '2026-09-01T10:00:00', [set('x', 50, 10)])
    expect(prsInSession([s1], s1)).toEqual([])
  })
  it('detects weight PR vs earlier sessions', () => {
    const s1 = session('a', '2026-09-01T10:00:00', [set('x', 50, 10)])
    const s2 = session('b', '2026-09-05T10:00:00', [set('x', 55, 8)])
    expect(prsInSession([s1, s2], s2)).toEqual([{ exerciseId: 'x', kind: 'weight', value: 55 }])
  })
})

describe('plan helpers', () => {
  it('cycles days after last session', () => {
    expect(nextDayIndex([], program)).toBe(0)
    const a = session('a', '2026-09-01T10:00:00', [], 'd1')
    const b = session('b', '2026-09-03T10:00:00', [], 'd3')
    expect(nextDayIndex([a], program)).toBe(1)
    expect(nextDayIndex([a, b], program)).toBe(0)
  })
  it('adherence is capped at 100% and null without program', () => {
    expect(adherence([], null, 4)).toBeNull()
    const now = new Date(2026, 9, 14)
    const list = Array.from({ length: 5 }, (_, i) => session(`s${i}`, new Date(2026, 9, 12 + (i % 3), 10).toISOString(), []))
    const a = adherence(list, program, 1, now)
    expect(a?.done).toBe(3)
    expect(a?.ratio).toBe(1)
  })
  it('weeklyVolume returns requested number of weeks', () => {
    const now = new Date(2026, 9, 14)
    const s = session('a', new Date(2026, 9, 13, 10).toISOString(), [set('x', 100, 10)])
    const w = weeklyVolume([s], 4, now)
    expect(w).toHaveLength(4)
    expect(w[3].volume).toBe(1000)
    expect(w[0].volume).toBe(0)
  })
})
