import type { Exercise, LoggedSet, PlannedExercise, WorkoutSession } from './types'

/** Формула Эпли: 1RM = вес × (1 + повторения / 30). Для 1 повторения возвращает сам вес. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Вес для заданного числа повторений до отказа по расчётному 1RM (обратная формула Эпли). */
export function weightForReps(oneRm: number, reps: number): number {
  if (oneRm <= 0 || reps <= 0) return 0
  if (reps === 1) return oneRm
  return oneRm / (1 + reps / 30)
}

export function roundToStep(weight: number, step: number, mode: 'nearest' | 'down' = 'nearest') {
  if (step <= 0) return weight
  const q = weight / step
  const n = mode === 'down' ? Math.floor(q + 1e-9) : Math.round(q)
  return Math.round(n * step * 100) / 100
}

/** Не меньше пустого снаряда (гриф), не меньше нуля. */
export function clampWeight(weight: number, ex: Exercise): number {
  const floor = ex.bar > 0 ? ex.bar : 0
  return Math.max(floor, Math.round(weight * 100) / 100)
}

export function stepUp(weight: number, ex: Exercise) {
  return clampWeight(roundToStep(weight + ex.step, ex.step), ex)
}
export function stepDown(weight: number, ex: Exercise) {
  return clampWeight(roundToStep(weight - ex.step, ex.step), ex)
}

export interface TestSet {
  weight: number
  reps: number
  rir: number
}

export interface WeightSuggestion {
  weight: number
  oneRm: number
  explanation: string
}

/**
 * Способ B + C: тестовый подход → предварительный рабочий вес.
 * Учитываем запас повторений: «эффективные» повторения = reps + RIR.
 * Для новичков и сложных упражнений делаем вес чуть консервативнее.
 */
export function suggestFromTestSet(
  ex: Exercise,
  test: TestSet,
  planned: Pick<PlannedExercise, 'repMin' | 'repMax' | 'rir'>,
  conservative = false,
): WeightSuggestion {
  const effectiveReps = Math.min(test.reps + test.rir, 30)
  const oneRm = epley1RM(test.weight, effectiveReps)
  const targetReps = Math.round((planned.repMin + planned.repMax) / 2)
  // для работы с запасом повторений берём вес на (целевые повторения + RIR)
  let raw = weightForReps(oneRm, targetReps + planned.rir)
  if (conservative) raw *= 0.92
  const weight = clampWeight(roundToStep(raw, ex.step, 'down'), ex)
  return {
    weight,
    oneRm: Math.round(oneRm * 10) / 10,
    explanation:
      `По тестовому подходу (${test.weight} кг × ${test.reps}, запас ${test.rir}) расчётный 1RM ≈ ${Math.round(oneRm)} кг. ` +
      `Для ${targetReps} повторений с запасом ${planned.rir} подходит около ${weight} кг. ` +
      `Это оценка, а не гарантия: на разных тренажёрах веса не сопоставимы. Скорректируйте по ощущениям.`,
  }
}

export interface BeginnerGuide {
  steps: string[]
}

/** Способ D: без истории не выдумываем число — предлагаем процедуру подбора. */
export function beginnerFindingProcedure(ex: Exercise): BeginnerGuide {
  const start = ex.bar > 0 ? `Начните с пустого снаряда (${ex.bar} кг).` : 'Начните с минимального веса на стеке.'
  return {
    steps: [
      start,
      'Сделайте 10–12 лёгких повторений, следя за техникой. Если легко — добавьте один шаг веса.',
      `Повторяйте, пока подход из 8–12 повторений не станет заметно тяжёлым, но с запасом 2–3 повторения.`,
      'Если техника страдает или есть боль — вернитесь на шаг назад.',
      'Введите результат такого подхода как тестовый — приложение сохранит рабочий вес.',
    ],
  }
}

export type ProgressionAction = 'increase' | 'hold' | 'decrease' | 'stop' | 'first_time'

export interface Progression {
  action: ProgressionAction
  weight: number | null
  explanation: string
}

export interface ProgressionInput {
  ex: Exercise
  planned: PlannedExercise
  lastSets: LoggedSet[]
  lastFlag?: 'pain' | 'form'
  daysSinceLast?: number
  currentWeight: number | null
}

/** Прогрессия двойным методом: достигли верха диапазона во всех подходах с запасом → +1 шаг. */
export function recommendProgression(i: ProgressionInput): Progression {
  const { ex, planned, lastSets } = i
  if (lastSets.length === 0) {
    return {
      action: 'first_time',
      weight: i.currentWeight,
      explanation:
        i.currentWeight !== null
          ? 'Истории по этому упражнению нет — используем вес из тестового подхода.'
          : 'Истории по этому упражнению нет. Подберите вес через лёгкий подход (см. подсказку).',
    }
  }
  const lastWeight = Math.max(...lastSets.map((s) => s.weight))
  const base = i.currentWeight ?? lastWeight

  if (i.lastFlag === 'pain') {
    return {
      action: 'stop',
      weight: clampWeight(roundToStep(lastWeight * 0.9, ex.step, 'down'), ex),
      explanation:
        'В прошлый раз была боль. Не повышайте нагрузку: начните с облегчённого веса, а при повторении боли остановитесь и обратитесь к специалисту.',
    }
  }
  if (typeof i.daysSinceLast === 'number' && i.daysSinceLast > 21) {
    return {
      action: 'decrease',
      weight: clampWeight(roundToStep(lastWeight * 0.9, ex.step, 'down'), ex),
      explanation: `Перерыв ${i.daysSinceLast} дн. Вернитесь на ~10% ниже прошлого веса и набирайте его обратно.`,
    }
  }
  if (i.lastFlag === 'form') {
    return {
      action: 'hold',
      weight: base,
      explanation: 'В прошлый раз ухудшилась техника — оставляем вес, цель — чистое выполнение.',
    }
  }
  const topSets = lastSets.filter((s) => s.weight >= lastWeight)
  const allTop = topSets.length >= planned.sets && topSets.every((s) => s.reps >= planned.repMax)
  const avgRir = topSets.reduce((a, s) => a + s.rir, 0) / topSets.length
  if (allTop && avgRir >= Math.max(planned.rir - 1, 0)) {
    return {
      action: 'increase',
      weight: stepUp(lastWeight, ex),
      explanation: `Вы выполнили все подходы в верхней границе диапазона (${planned.repMax}) с запасом повторений, поэтому в следующий раз можно попробовать увеличить вес на минимальный доступный шаг (${ex.step} кг).`,
    }
  }
  if (allTop) {
    return {
      action: 'hold',
      weight: lastWeight,
      explanation: 'Повторения набраны, но запас был мал — закрепите этот вес, прежде чем повышать.',
    }
  }
  const avgReps = topSets.reduce((a, s) => a + s.reps, 0) / topSets.length
  if (topSets.length >= 2 && avgReps < planned.repMin) {
    return {
      action: 'decrease',
      weight: stepDown(lastWeight, ex),
      explanation: `Среднее ${avgReps.toFixed(1)} повт. ниже диапазона (${planned.repMin}–${planned.repMax}) — снизьте вес на один шаг.`,
    }
  }
  return {
    action: 'hold',
    weight: lastWeight,
    explanation: `Цель — довести все подходы до ${planned.repMax} повторений. Оставляем вес и добавляем повторения.`,
  }
}

export interface NextSetSuggestion {
  weight: number
  reps: number
  note: string
}

/** Подсказка для следующего подхода внутри тренировки по результату только что выполненного. */
export function nextSetSuggestion(
  ex: Exercise,
  planned: PlannedExercise,
  last: { weight: number; reps: number; rir: number },
): NextSetSuggestion {
  const mid = Math.round((planned.repMin + planned.repMax) / 2)
  if (last.reps < planned.repMin || last.rir < Math.max(planned.rir - 2, 0)) {
    return {
      weight: stepDown(last.weight, ex),
      reps: mid,
      note: 'Подход получился тяжелее плана — можно снизить вес на шаг.',
    }
  }
  if (last.reps > planned.repMax && last.rir >= planned.rir + 2) {
    return {
      weight: stepUp(last.weight, ex),
      reps: mid,
      note: 'Подход был слишком лёгким — можно добавить шаг.',
    }
  }
  return { weight: last.weight, reps: last.reps, note: 'Вес подходит — повторите.' }
}

export function setVolume(s: Pick<LoggedSet, 'weight' | 'reps'>) {
  return s.weight * s.reps
}

export function sessionVolume(session: WorkoutSession, exerciseId?: string) {
  return session.sets
    .filter((s) => !exerciseId || s.exerciseId === exerciseId)
    .reduce((a, s) => a + setVolume(s), 0)
}

/** Лучший расчётный 1RM по подходам; повторения > 12 слишком неточны, их не учитываем. */
export function best1RM(sets: LoggedSet[]): number | null {
  const valid = sets.filter((s) => s.weight > 0 && s.reps >= 1 && s.reps <= 12)
  if (valid.length === 0) return null
  return Math.max(...valid.map((s) => epley1RM(s.weight, s.reps)))
}
