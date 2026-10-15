import { describe, expect, it } from 'vitest'
import {
  best1RM,
  epley1RM,
  nextSetSuggestion,
  recommendProgression,
  roundToStep,
  suggestFromTestSet,
  weightForReps,
} from './calc'
import { getExercise } from '../data/exercises'
import type { LoggedSet, PlannedExercise } from './types'

const planned: PlannedExercise = { exerciseId: 'chest-press-machine', sets: 3, repMin: 8, repMax: 12, restSec: 90, rir: 2 }
const ex = getExercise('chest-press-machine')

const mk = (weight: number, reps: number, rir = 2): LoggedSet => ({
  id: Math.random().toString(),
  exerciseId: ex.id,
  setIndex: 0,
  weight,
  reps,
  rir,
  at: new Date().toISOString(),
})

describe('Epley', () => {
  it('computes 1RM', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1)
    expect(epley1RM(80, 1)).toBe(80)
    expect(epley1RM(0, 5)).toBe(0)
  })
  it('inverse works', () => {
    expect(weightForReps(epley1RM(60, 8), 8)).toBeCloseTo(60, 5)
  })
})

describe('roundToStep', () => {
  it('rounds to machine step', () => {
    expect(roundToStep(47, 5)).toBe(45)
    expect(roundToStep(47, 5, 'down')).toBe(45)
    expect(roundToStep(49, 5, 'down')).toBe(45)
  })
})

describe('suggestFromTestSet', () => {
  it('returns weight aligned to step and below test 1RM', () => {
    const r = suggestFromTestSet(ex, { weight: 40, reps: 10, rir: 2 }, planned)
    expect(r.weight % ex.step).toBe(0)
    expect(r.weight).toBeLessThan(r.oneRm)
    expect(r.weight).toBeGreaterThan(0)
  })
  it('conservative mode lowers weight', () => {
    const a = suggestFromTestSet(ex, { weight: 40, reps: 10, rir: 2 }, planned)
    const b = suggestFromTestSet(ex, { weight: 40, reps: 10, rir: 2 }, planned, true)
    expect(b.weight).toBeLessThanOrEqual(a.weight)
  })
})

describe('recommendProgression', () => {
  it('increases when all sets hit top of range with reserve', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 12), mk(40, 12), mk(40, 12)], currentWeight: 40 })
    expect(r.action).toBe('increase')
    expect(r.weight).toBe(45)
  })
  it('holds when top reps but no reserve', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 12, 0), mk(40, 12, 0), mk(40, 12, 0)], currentWeight: 40 })
    expect(r.action).toBe('hold')
  })
  it('does not increase if range not reached', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 12), mk(40, 10), mk(40, 9)], currentWeight: 40 })
    expect(r.action).toBe('hold')
  })
  it('decreases if far below range', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 6), mk(40, 5), mk(40, 5)], currentWeight: 40 })
    expect(r.action).toBe('decrease')
    expect(r.weight).toBe(35)
  })
  it('stops on pain and never increases', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 12), mk(40, 12), mk(40, 12)], lastFlag: 'pain', currentWeight: 40 })
    expect(r.action).toBe('stop')
    expect(r.weight!).toBeLessThan(40)
  })
  it('holds on form issue', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 12), mk(40, 12), mk(40, 12)], lastFlag: 'form', currentWeight: 40 })
    expect(r.action).toBe('hold')
  })
  it('reduces after long break', () => {
    const r = recommendProgression({ ex, planned, lastSets: [mk(40, 10)], daysSinceLast: 30, currentWeight: 40 })
    expect(r.action).toBe('decrease')
  })
  it('first time without history', () => {
    const r = recommendProgression({ ex, planned, lastSets: [], currentWeight: null })
    expect(r.action).toBe('first_time')
    expect(r.weight).toBeNull()
  })
})

describe('nextSetSuggestion', () => {
  it('lowers if too hard', () => {
    expect(nextSetSuggestion(ex, planned, { weight: 40, reps: 5, rir: 0 }).weight).toBe(35)
  })
  it('keeps if on target', () => {
    expect(nextSetSuggestion(ex, planned, { weight: 40, reps: 10, rir: 2 }).weight).toBe(40)
  })
})

describe('best1RM', () => {
  it('ignores high-rep sets', () => {
    expect(best1RM([mk(20, 25)])).toBeNull()
    expect(best1RM([mk(40, 10), mk(30, 8)])).toBeCloseTo(53.33, 1)
  })
})
