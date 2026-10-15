import { describe, expect, it } from 'vitest'
import { alternativesFor, dosage, estimateMinutes, generateProgram, isAllowed, recommendSplit, weeklySets } from './program'
import { getExercise } from '../data/exercises'
import type { Profile } from './types'

const base: Profile = {
  age: 28,
  sex: '',
  heightCm: 178,
  weightKg: 80,
  level: 'beginner',
  experienceMonths: 2,
  goal: 'muscle',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: ['stack_machine', 'plate_machine', 'dumbbell', 'cable', 'bodyweight'],
  preferred: [],
  limitations: [],
}

describe('generateProgram', () => {
  it('creates requested number of days', () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const p = generateProgram({ ...base, daysPerWeek: d })
      expect(p.days.length).toBe(d)
    }
  })
  it('only uses available equipment', () => {
    const p = generateProgram({ ...base, equipment: ['dumbbell'] })
    for (const day of p.days)
      for (const e of day.exercises)
        expect(['dumbbell', 'bodyweight']).toContain(getExercise(e.exerciseId).equipment)
  })
  it('respects limitations', () => {
    const p = generateProgram({ ...base, limitations: ['knee'] })
    for (const day of p.days)
      for (const e of day.exercises) expect(getExercise(e.exerciseId).stresses).not.toContain('knee')
  })
  it('fits session time', () => {
    const p = generateProgram({ ...base, sessionMinutes: 45 })
    for (const day of p.days) expect(estimateMinutes(day.exercises)).toBeLessThanOrEqual(45 + 8)
  })
  it('beginner gets fewer sets per compound exercise than advanced, with more reserve', () => {
    const ex = getExercise('leg-press')
    const a = dosage(ex, { goal: 'muscle', level: 'beginner' })
    const b = dosage(ex, { goal: 'muscle', level: 'advanced' })
    expect(a.sets).toBeLessThan(b.sets)
    expect(a.rir).toBeGreaterThan(b.rir)
  })
  it('prefers preferred exercise', () => {
    const p = generateProgram({ ...base, preferred: ['db-bench-press'] })
    expect(p.days[0].exercises.some((e) => e.exerciseId === 'db-bench-press')).toBe(true)
  })
  it('weekly volume is calculable', () => {
    expect(weeklySets(generateProgram(base)).chest).toBeGreaterThan(0)
  })
})

describe('helpers', () => {
  it('recommends split by days', () => {
    expect(recommendSplit({ daysPerWeek: 2, level: 'beginner' })).toBe('full_body')
    expect(recommendSplit({ daysPerWeek: 4, level: 'beginner' })).toBe('upper_lower')
    expect(recommendSplit({ daysPerWeek: 6, level: 'advanced' })).toBe('ppl')
  })
  it('cardio is not allowed in generator', () => {
    expect(isAllowed(getExercise('treadmill'), { equipment: ['cardio'], limitations: [] })).toBe(false)
  })
  it('alternatives respect equipment', () => {
    const alts = alternativesFor('chest-press-machine', { equipment: ['dumbbell'], limitations: [] })
    expect(alts.length).toBeGreaterThan(0)
    for (const a of alts) expect(['dumbbell', 'bodyweight']).toContain(a.equipment)
  })
})
