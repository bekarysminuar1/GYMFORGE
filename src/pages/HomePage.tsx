import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts'
import { Trophy, User } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, EmptyState } from '../components/ui'
import MuscleMap from '../components/MuscleMap'
import { MUSCLE_LABEL, getExercise } from '../data/exercises'
import { estimateMinutes } from '../lib/program'
import { sessionVolume } from '../lib/calc'
import {
  WEEKDAY_SHORT,
  dayKey,
  finishedSessions,
  formatVolume,
  nextDayIndex,
  prsInSession,
  sessionsInWeek,
  shortDate,
  weekDays,
  weeklyVolume,
} from '../lib/stats'

export default function HomePage() {
  const { data, activeProgram: prog, startSession } = useStore()
  const nav = useNavigate()
  const now = new Date()
  const days = weekDays(now)
  const done = new Set(finishedSessions(data.sessions).map((s) => dayKey(s.startedAt)))
  const week = sessionsInWeek(data.sessions, now)
  const idx = nextDayIndex(data.sessions, prog)
  const day = prog?.days[idx]
  const all = finishedSessions(data.sessions)
  const last = all[all.length - 1]
  const wv = weeklyVolume(data.sessions, 8)
  const planned = prog?.days.length ?? 0
  const muscles = day ? [...new Set(day.focus)] : []

  const start = () => {
    if (data.activeSession) return nav('/workout')
    if (prog && day) {
      startSession(prog.id, day.id)
      nav('/workout')
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm text-mute">{shortDate(now)}</div>
          <h1 className="num text-5xl">Сегодня</h1>
        </div>
        <Link to="/profile" aria-label="Профиль" className="grid h-12 w-12 place-items-center rounded-full bg-surface text-mute hover:text-ink">
          <User size={22} />
        </Link>
      </header>

      <div className="flex justify-between gap-1" aria-label="Текущая неделя">
        {days.map((d, i) => {
          const isToday = dayKey(d) === dayKey(now)
          return (
            <div
              key={i}
              className={`flex w-full max-w-[3.25rem] flex-col items-center gap-1 rounded-full py-2 ${isToday ? 'ring-2 ring-lime' : 'bg-surface'}`}
            >
              <span className="text-[11px] font-bold text-mute">{WEEKDAY_SHORT[i]}</span>
              <span className="num text-xl leading-none">{d.getDate()}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${done.has(dayKey(d)) ? 'bg-lime' : 'bg-transparent'}`} />
            </div>
          )
        })}
      </div>

      {!prog || !day ? (
        <EmptyState
          title="Нет программы"
          text="Создайте программу, и здесь появится следующая тренировка."
          action={
            <Link to="/program">
              <Button variant="primary">Создать программу</Button>
            </Link>
          }
        />
      ) : (
        <section className="relative overflow-hidden rounded-[1.75rem] bg-lime p-6 text-bg">
          <MuscleMap
            primary={day.focus}
            view="auto"
            className="pointer-events-none absolute -right-2 top-3 h-56 w-auto opacity-25 [--color-lime:#17191d] [--color-line:#17191d33] [--color-surface-2:#17191d1a]"
          />
          <div className="relative">
            <div className="text-sm font-extrabold uppercase tracking-wider opacity-70">
              {data.activeSession ? 'Тренировка идёт' : 'Следующая тренировка'}
            </div>
            <h2 className="num mt-1 text-6xl leading-[0.95]">{day.name}</h2>
            <div className="mt-2 max-w-[14rem] text-[15px] font-bold">{muscles.map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
            <div className="mt-5 flex gap-5 text-sm font-bold">
              <span>
                <span className="num text-3xl">{estimateMinutes(day.exercises)}</span> мин
              </span>
              <span>
                <span className="num text-3xl">{day.exercises.length}</span> упр.
              </span>
            </div>
            <button
              onClick={start}
              className="mt-6 h-16 w-full rounded-2xl bg-bg text-lg font-extrabold text-lime transition active:scale-[0.98]"
            >
              {data.activeSession ? 'Продолжить тренировку' : 'Начать тренировку'}
            </button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-5 gap-3">
        <div className="col-span-2 rounded-[1.25rem] bg-surface p-4">
          <div className="text-xs font-semibold text-mute">Эта неделя</div>
          <div className="num mt-1 text-6xl leading-none">
            {week.length}
            <span className="text-2xl text-mute">/{planned || '—'}</span>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: planned }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < week.length ? 'bg-lime' : 'bg-line'}`} />
            ))}
          </div>
        </div>
        <div className="col-span-3 rounded-[1.25rem] bg-surface p-4">
          <div className="text-xs font-semibold text-mute">Объём по неделям</div>
          <div className="h-24">
            {all.length === 0 ? (
              <div className="pt-6 text-sm text-mute">Появится после первой тренировки.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wv} margin={{ top: 8, bottom: 0, left: 0, right: 0 }}>
                  <XAxis dataKey="label" hide />
                  <Bar dataKey="volume" fill="#C8FF36" radius={4} background={{ fill: '#2a2e35', radius: 4 }} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-extrabold">Последняя тренировка</h3>
        {!last ? (
          <EmptyState title="Пока пусто" text="Завершите первую тренировку, и она появится здесь." />
        ) : (
          <Link to="/progress" className="block rounded-[1.25rem] bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-extrabold">{last.dayName}</div>
              <div className="text-sm text-mute">{shortDate(last.startedAt)}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 text-sm text-mute">
              <span>{last.sets.length} подходов</span>
              <span>{formatVolume(sessionVolume(last))}</span>
              {prsInSession(data.sessions, last).length > 0 && (
                <span className="flex items-center gap-1 font-bold text-ember">
                  <Trophy size={14} /> {prsInSession(data.sessions, last).length} рекорд
                </span>
              )}
            </div>
            <div className="mt-2 truncate text-xs text-mute">
              {[...new Set(last.sets.map((s) => getExercise(s.exerciseId).name))].join(' · ')}
            </div>
          </Link>
        )}
      </section>
    </div>
  )
}
