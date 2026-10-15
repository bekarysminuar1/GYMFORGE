export type Level = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'muscle' | 'fat_loss' | 'strength' | 'general'
export type SplitType = 'full_body' | 'upper_lower' | 'ppl' | 'bro_split' | 'custom'

export type Equipment =
  | 'stack_machine'
  | 'plate_machine'
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'smith'
  | 'bodyweight'
  | 'cardio'

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'cardio'

export interface Exercise {
  id: string
  name: string
  nameEn: string
  equipment: Equipment
  primary: Muscle[]
  secondary: Muscle[]
  /** Минимальный доступный шаг изменения веса, кг */
  step: number
  /** Вес пустого снаряда (гриф и т.п.), кг. Для тренажёров — 0 */
  bar: number
  compound: boolean
  /** Статическое упражнение: «повторения» — это секунды удержания */
  timed?: boolean
  setup: string
  start: string
  steps: string[]
  range: string
  breathing: string
  mistakes: string[]
  safety: string[]
  alternatives: string[]
  /** Противопоказания по зонам, для учёта травм */
  stresses: ('shoulder' | 'knee' | 'back' | 'wrist' | 'elbow')[]
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  /** Целевой запас повторений */
  rir: number
}

export interface ProgramDay {
  id: string
  name: string
  focus: Muscle[]
  exercises: PlannedExercise[]
}

export interface Program {
  id: string
  name: string
  split: SplitType
  days: ProgramDay[]
  createdAt: string
}

export interface Profile {
  age: number
  sex: 'male' | 'female' | 'other' | ''
  heightCm: number
  weightKg: number
  level: Level
  experienceMonths: number
  goal: Goal
  daysPerWeek: number
  sessionMinutes: number
  equipment: Equipment[]
  preferred: string[]
  limitations: ('shoulder' | 'knee' | 'back' | 'wrist' | 'elbow')[]
}

export interface Settings {
  unit: 'kg'
  restDefaultSec: number
  vibrate: boolean
}

export interface LoggedSet {
  id: string
  exerciseId: string
  setIndex: number
  weight: number
  reps: number
  rir: number
  at: string
}

export interface SessionExercise {
  exerciseId: string
  planned: PlannedExercise
  skipped: boolean
  /** Рабочий вес, предложенный в начале упражнения */
  suggestedWeight: number | null
}

export interface WorkoutSession {
  id: string
  programId: string
  dayId: string
  dayName: string
  startedAt: string
  finishedAt: string | null
  exercises: SessionExercise[]
  sets: LoggedSet[]
  /** Субъективная техника/самочувствие по упражнению: true = были боль или плохая техника */
  flags: Record<string, 'pain' | 'form' | undefined>
}

export interface BodyMeasurement {
  id: string
  date: string
  weightKg: number
}

export interface AppData {
  version: 1
  profile: Profile | null
  settings: Settings
  programs: Program[]
  activeProgramId: string | null
  sessions: WorkoutSession[]
  /** Вес, с которым пользователь работает по упражнению сейчас (из тестового подхода или прогрессии) */
  workingWeights: Record<string, number>
  body: BodyMeasurement[]
  activeSession: WorkoutSession | null
}
