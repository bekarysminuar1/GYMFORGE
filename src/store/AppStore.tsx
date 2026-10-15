import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppData,
  LoggedSet,
  PlannedExercise,
  Profile,
  Program,
  WorkoutSession,
} from '../lib/types'
import { getExercise } from '../data/exercises'
import { recommendProgression, type Progression } from '../lib/calc'
import { uid } from '../lib/program'

const KEY = 'gymforge:v1'

export const emptyData = (): AppData => ({
  version: 1,
  profile: null,
  settings: { unit: 'kg', restDefaultSec: 90, vibrate: true },
  programs: [],
  activeProgramId: null,
  sessions: [],
  workingWeights: {},
  body: [],
  activeSession: null,
})

function isValid(d: unknown): d is AppData {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  return (
    o.version === 1 &&
    Array.isArray(o.programs) &&
    Array.isArray(o.sessions) &&
    Array.isArray(o.body) &&
    typeof o.workingWeights === 'object' &&
    o.workingWeights !== null &&
    typeof o.settings === 'object'
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'corrupt'; raw: string }

interface Ctx {
  data: AppData
  load: LoadState
  storageError: string | null
  activeProgram: Program | null
  saveProfile(p: Profile): void
  addProgram(p: Program, makeActive?: boolean): void
  updateProgram(p: Program): void
  deleteProgram(id: string): void
  setActiveProgram(id: string): void
  startSession(programId: string, dayId: string): WorkoutSession | null
  logSet(s: Omit<LoggedSet, 'id' | 'at'>): void
  undoLastSet(exerciseId: string): void
  replaceExercise(index: number, newExerciseId: string): void
  skipExercise(index: number, skipped: boolean): void
  flagExercise(exerciseId: string, flag: 'pain' | 'form' | undefined): void
  finishSession(): WorkoutSession | null
  discardSession(): void
  setWorkingWeight(exerciseId: string, w: number): void
  addBodyWeight(date: string, kg: number): void
  deleteBodyWeight(id: string): void
  updateSettings(s: Partial<AppData['settings']>): void
  resetAll(): void
  importData(raw: string): boolean
  exportData(): string
  recommendation(exerciseId: string, planned: PlannedExercise): Progression
  lastSetsFor(exerciseId: string): LoggedSet[]
}

const StoreCtx = createContext<Ctx | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [storageError, setStorageError] = useState<string | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isValid(parsed)) setData({ ...emptyData(), ...parsed })
        else {
          setLoad({ status: 'corrupt', raw })
          return
        }
      }
    } catch (e) {
      const raw = (() => {
        try {
          return localStorage.getItem(KEY) ?? ''
        } catch {
          return ''
        }
      })()
      if (raw) {
        setLoad({ status: 'corrupt', raw })
        return
      }
      setStorageError('Локальное хранилище недоступно: данные не сохранятся после перезагрузки.')
      console.error(e)
    }
    ready.current = true
    setLoad({ status: 'ready' })
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
      setStorageError(null)
    } catch {
      setStorageError('Не удалось сохранить данные (хранилище заполнено или отключено).')
    }
  }, [data])

  const mutate = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])

  const lastSetsFor = useCallback(
    (exerciseId: string) => {
      const sessions = [...data.sessions]
        .filter((s) => s.finishedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      for (const s of sessions) {
        const sets = s.sets.filter((x) => x.exerciseId === exerciseId)
        if (sets.length) return sets
      }
      return []
    },
    [data.sessions],
  )

  const recommendation = useCallback(
    (exerciseId: string, planned: PlannedExercise): Progression => {
      const ex = getExercise(exerciseId)
      const last = lastSetsFor(exerciseId)
      let flag: 'pain' | 'form' | undefined
      let days: number | undefined
      const sess = [...data.sessions]
        .filter((s) => s.finishedAt && s.sets.some((x) => x.exerciseId === exerciseId))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
      if (sess) {
        flag = sess.flags?.[exerciseId]
        days = Math.floor((Date.now() - new Date(sess.finishedAt ?? sess.startedAt).getTime()) / 86400000)
      }
      const r = recommendProgression({
        ex,
        planned,
        lastSets: last,
        lastFlag: flag,
        daysSinceLast: days,
        currentWeight: data.workingWeights[exerciseId] ?? null,
      })
      return r
    },
    [data.sessions, data.workingWeights, lastSetsFor],
  )

  const value = useMemo<Ctx>(() => {
    const activeProgram = data.programs.find((p) => p.id === data.activeProgramId) ?? null
    return {
      data,
      load,
      storageError,
      activeProgram,
      saveProfile: (p) => mutate((d) => ({ ...d, profile: p })),
      addProgram: (p, makeActive = true) =>
        mutate((d) => ({
          ...d,
          programs: [...d.programs, p],
          activeProgramId: makeActive || !d.activeProgramId ? p.id : d.activeProgramId,
        })),
      updateProgram: (p) => mutate((d) => ({ ...d, programs: d.programs.map((x) => (x.id === p.id ? p : x)) })),
      deleteProgram: (id) =>
        mutate((d) => {
          const programs = d.programs.filter((p) => p.id !== id)
          return {
            ...d,
            programs,
            activeProgramId: d.activeProgramId === id ? (programs[0]?.id ?? null) : d.activeProgramId,
          }
        }),
      setActiveProgram: (id) => mutate((d) => ({ ...d, activeProgramId: id })),
      startSession: (programId, dayId) => {
        const prog = data.programs.find((p) => p.id === programId)
        const day = prog?.days.find((x) => x.id === dayId)
        if (!prog || !day) return null
        const s: WorkoutSession = {
          id: uid(),
          programId,
          dayId,
          dayName: day.name,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          exercises: day.exercises.map((pe) => ({
            exerciseId: pe.exerciseId,
            planned: pe,
            skipped: false,
            suggestedWeight: recommendation(pe.exerciseId, pe).weight,
          })),
          sets: [],
          flags: {},
        }
        mutate((d) => ({ ...d, activeSession: s }))
        return s
      },
      logSet: (s) =>
        mutate((d) =>
          d.activeSession
            ? {
                ...d,
                activeSession: {
                  ...d.activeSession,
                  sets: [...d.activeSession.sets, { ...s, id: uid(), at: new Date().toISOString() }],
                },
              }
            : d,
        ),
      undoLastSet: (exerciseId) =>
        mutate((d) => {
          const a = d.activeSession
          if (!a) return d
          const idx = [...a.sets].map((x) => x.exerciseId).lastIndexOf(exerciseId)
          if (idx < 0) return d
          return { ...d, activeSession: { ...a, sets: a.sets.filter((_, i) => i !== idx) } }
        }),
      replaceExercise: (index, newId) =>
        mutate((d) => {
          const a = d.activeSession
          if (!a || !a.exercises[index]) return d
          const old = a.exercises[index]
          const planned = { ...old.planned, exerciseId: newId }
          const exercises = a.exercises.map((e, i) =>
            i === index
              ? { ...e, exerciseId: newId, planned, skipped: false, suggestedWeight: recommendation(newId, planned).weight }
              : e,
          )
          return { ...d, activeSession: { ...a, exercises } }
        }),
      skipExercise: (index, skipped) =>
        mutate((d) => {
          const a = d.activeSession
          if (!a) return d
          return {
            ...d,
            activeSession: { ...a, exercises: a.exercises.map((e, i) => (i === index ? { ...e, skipped } : e)) },
          }
        }),
      flagExercise: (exerciseId, flag) =>
        mutate((d) =>
          d.activeSession
            ? { ...d, activeSession: { ...d.activeSession, flags: { ...d.activeSession.flags, [exerciseId]: flag } } }
            : d,
        ),
      finishSession: () => {
        const a = data.activeSession
        if (!a) return null
        const finished: WorkoutSession = { ...a, finishedAt: new Date().toISOString() }
        mutate((d) => {
          // обновляем рабочие веса по результатам тренировки
          const ww = { ...d.workingWeights }
          const history = [...d.sessions, finished]
          for (const e of finished.exercises) {
            const sets = finished.sets.filter((s) => s.exerciseId === e.exerciseId)
            if (!sets.length) continue
            const r = recommendProgression({
              ex: getExercise(e.exerciseId),
              planned: e.planned,
              lastSets: sets,
              lastFlag: finished.flags[e.exerciseId],
              currentWeight: ww[e.exerciseId] ?? null,
            })
            if (r.weight !== null) ww[e.exerciseId] = r.weight
          }
          void history
          return { ...d, sessions: [...d.sessions, finished], activeSession: null, workingWeights: ww }
        })
        return finished
      },
      discardSession: () => mutate((d) => ({ ...d, activeSession: null })),
      setWorkingWeight: (exerciseId, w) =>
        mutate((d) => ({ ...d, workingWeights: { ...d.workingWeights, [exerciseId]: w } })),
      addBodyWeight: (date, kg) =>
        mutate((d) => ({
          ...d,
          body: [...d.body.filter((b) => b.date !== date), { id: uid(), date, weightKg: kg }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
          profile: d.profile ? { ...d.profile, weightKg: kg } : d.profile,
        })),
      deleteBodyWeight: (id) => mutate((d) => ({ ...d, body: d.body.filter((b) => b.id !== id) })),
      updateSettings: (s) => mutate((d) => ({ ...d, settings: { ...d.settings, ...s } })),
      resetAll: () => {
        try {
          localStorage.removeItem(KEY)
        } catch {
          /* ignore */
        }
        ready.current = true
        setData(emptyData())
        setLoad({ status: 'ready' })
      },
      importData: (raw) => {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (!isValid(parsed)) return false
          ready.current = true
          setData({ ...emptyData(), ...parsed })
          setLoad({ status: 'ready' })
          return true
        } catch {
          return false
        }
      },
      exportData: () => JSON.stringify(data, null, 2),
      recommendation,
      lastSetsFor,
    }
  }, [data, load, storageError, mutate, recommendation, lastSetsFor])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore must be used inside AppStoreProvider')
  return c
}
