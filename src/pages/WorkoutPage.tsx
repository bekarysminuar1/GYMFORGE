import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, MoreHorizontal, Trophy, Undo2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, Chip, ConfirmDialog, EmptyState, Label, Modal, Stepper } from '../components/ui'
import MuscleMap from '../components/MuscleMap'
import WeightCalculator from '../components/WeightCalculator'
import ExerciseDetail from '../components/ExerciseDetail'
import { EQUIPMENT_LABEL, getExercise } from '../data/exercises'
import { nextSetSuggestion, sessionVolume } from '../lib/calc'
import { alternativesFor, estimateMinutes } from '../lib/program'
import { setInputSchema } from '../lib/schemas'
import { finishedSessions, formatDuration, formatKg, formatVolume, nextDayIndex, prsInSession } from '../lib/stats'
import type { WorkoutSession } from '../lib/types'

export default function WorkoutPage() {
  const s = useStore()
  const { data, activeProgram: prog } = s
  const nav = useNavigate()
  const [summary, setSummary] = useState<WorkoutSession | null>(null)
  const [now, setNow] = useState(Date.now())
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const [calc, setCalc] = useState(false)
  const [tech, setTech] = useState(false)
  const [replace, setReplace] = useState(false)
  const [confirm, setConfirm] = useState<'discard' | 'finish' | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [reps, setReps] = useState(10)
  const [rir, setRir] = useState(2)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const buzzed = useRef(false)

  const a = data.activeSession
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const counts = useMemo(
    () => (a ? a.exercises.map((e) => a.sets.filter((x) => x.exerciseId === e.exerciseId).length) : []),
    [a],
  )
  const autoIdx = a ? a.exercises.findIndex((e, i) => !e.skipped && counts[i] < e.planned.sets) : -1
  const cur = a ? (sel !== null && a.exercises[sel] ? sel : autoIdx) : -1
  const item = a && cur >= 0 ? a.exercises[cur] : null
  const ex = item ? getExercise(item.exerciseId) : null
  const done = item ? counts[cur] : 0
  const exSets = a && item ? a.sets.filter((x) => x.exerciseId === item.exerciseId) : []
  const prevSets = item ? s.lastSetsFor(item.exerciseId) : []
  const key = item ? `${cur}-${item.exerciseId}-${done}` : ''

  // подставляем значения для следующего подхода
  useEffect(() => {
    if (!item || !ex) return
    const lastSet = exSets[exSets.length - 1]
    const mid = Math.round((item.planned.repMin + item.planned.repMax) / 2)
    if (lastSet) {
      const n = nextSetSuggestion(ex, item.planned, lastSet)
      setWeight(n.weight)
      setReps(n.reps)
      setHint(n.note)
    } else {
      setWeight(item.suggestedWeight ?? data.workingWeights[item.exerciseId] ?? null)
      setReps(prevSets[0]?.reps ?? mid)
      setHint('')
    }
    setRir(item.planned.rir)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0
  useEffect(() => {
    if (restEnd && restLeft === 0 && !buzzed.current) {
      buzzed.current = true
      if (data.settings.vibrate) navigator.vibrate?.([200, 100, 200])
    }
  }, [restEnd, restLeft, data.settings.vibrate])
  const startRest = (sec: number) => {
    buzzed.current = false
    setRestEnd(Date.now() + sec * 1000)
  }

  // ===== Итог тренировки =====
  if (summary) {
    const prs = prsInSession(data.sessions, summary)
    const dur = new Date(summary.finishedAt ?? Date.now()).getTime() - new Date(summary.startedAt).getTime()
    return (
      <div className="space-y-6">
        <h1 className="num text-6xl text-lime">Готово</h1>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            [formatDuration(dur), 'время'],
            [String(summary.sets.length), 'подходов'],
            [formatVolume(sessionVolume(summary)), 'объём'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-surface p-3">
              <div className="num text-3xl">{v}</div>
              <div className="text-xs text-mute">{l}</div>
            </div>
          ))}
        </div>
        {prs.length > 0 && (
          <div className="space-y-2">
            {prs.map((p) => (
              <div key={p.exerciseId + p.kind} className="flex items-center gap-2 rounded-2xl bg-ember/15 p-3 font-bold text-ember">
                <Trophy size={18} /> Рекорд: {getExercise(p.exerciseId).name} — {p.kind === 'weight' ? '' : '1RM ≈ '}
                {formatKg(p.value)} кг
              </div>
            ))}
          </div>
        )}
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Что делать в следующий раз</h2>
          <div className="space-y-2">
            {summary.exercises
              .filter((e) => !e.skipped && summary.sets.some((x) => x.exerciseId === e.exerciseId))
              .map((e) => {
                const r = s.recommendation(e.exerciseId, e.planned)
                return (
                  <div key={e.exerciseId} className="rounded-2xl bg-surface p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-bold">{getExercise(e.exerciseId).name}</div>
                      {r.weight !== null && <div className="num text-3xl text-lime">{formatKg(r.weight)} кг</div>}
                    </div>
                    <p className="mt-1 text-sm text-mute">{r.explanation}</p>
                  </div>
                )
              })}
          </div>
        </section>
        <Button variant="primary" size="lg" className="w-full" onClick={() => { setSummary(null); nav('/') }}>
          На главную
        </Button>
        <Link to="/progress" className="block text-center text-sm font-bold text-mute">
          Открыть историю и графики
        </Link>
      </div>
    )
  }

  // ===== Нет активной тренировки =====
  if (!a) {
    if (!prog) return <EmptyState title="Нет программы" text="Сначала создайте программу." action={<Link to="/program"><Button variant="primary">К программе</Button></Link>} />
    const next = nextDayIndex(data.sessions, prog)
    const lastDone = finishedSessions(data.sessions)
    return (
      <div className="space-y-5">
        <h1 className="num text-5xl">Тренировка</h1>
        <p className="text-mute">Выберите день. Рекомендуемый — первый в списке.</p>
        {[...prog.days.map((d, i) => ({ d, i }))]
          .sort((x, y) => (x.i === next ? -1 : y.i === next ? 1 : x.i - y.i))
          .map(({ d, i }) => {
            const last = [...lastDone].reverse().find((x) => x.dayId === d.id)
            return (
              <div key={d.id} className={`rounded-[1.25rem] p-4 ${i === next ? 'bg-surface ring-2 ring-lime' : 'bg-surface'}`}>
                <div className="flex items-baseline justify-between">
                  <div className="num text-4xl">{d.name}</div>
                  <div className="text-sm text-mute">
                    {d.exercises.length} упр. · {estimateMinutes(d.exercises)} мин
                  </div>
                </div>
                <div className="mt-1 text-xs text-mute">{last ? `Последний раз: ${new Date(last.startedAt).toLocaleDateString('ru-RU')}` : 'Ещё не выполнялась'}</div>
                <Button
                  variant={i === next ? 'primary' : 'outline'}
                  size="lg"
                  className="mt-3 w-full"
                  onClick={() => s.startSession(prog.id, d.id)}
                >
                  Начать
                </Button>
              </div>
            )
          })}
      </div>
    )
  }

  const total = a.exercises.length
  const elapsed = formatDuration(now - new Date(a.startedAt).getTime())

  const finish = () => {
    const f = s.finishSession()
    setConfirm(null)
    setMenu(false)
    if (f) setSummary(f)
  }

  const log = () => {
    if (!item || !ex) return
    const r = setInputSchema.safeParse({ weight: weight ?? NaN, reps, rir })
    if (!r.success) return setError(weight === null ? 'Укажите вес или подберите его' : r.error.issues[0].message)
    setError('')
    s.logSet({ exerciseId: item.exerciseId, setIndex: done, ...r.data })
    setSel(null)
    const last = done + 1 >= item.planned.sets
    if (navigator.vibrate && data.settings.vibrate) navigator.vibrate(30)
    startRest(last ? 60 : item.planned.restSec)
  }

  const allDone = autoIdx < 0

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
      {/* верх */}
      <div className="flex items-center justify-between">
        <button aria-label="Меню тренировки" onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-lime">
          <MoreHorizontal />
        </button>
        <div className="num text-4xl text-lime" aria-label="Время тренировки">{elapsed}</div>
        <div className="w-11 text-right text-sm font-bold text-mute">
          {Math.min(cur + 1, total) || total}/{total}
        </div>
      </div>
      <div className="mt-3 flex gap-1" aria-hidden>
        {a.exercises.map((e, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${e.skipped ? 'bg-line/50' : counts[i] >= e.planned.sets ? 'bg-lime' : i === cur ? 'bg-lime/50' : 'bg-line'}`} />
        ))}
      </div>

      {allDone || !item || !ex ? (
        <div className="mt-10 space-y-5 text-center">
          <h1 className="num text-6xl">Все упражнения выполнены</h1>
          <Button variant="primary" size="lg" className="w-full" onClick={finish}>Завершить тренировку</Button>
          <p className="text-sm text-mute">Или вернитесь к упражнению через меню.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="num text-5xl leading-[0.95]">{ex.name}</h1>
              <button onClick={() => setTech(true)} className="mt-1 text-sm font-bold text-mute underline decoration-line underline-offset-4">
                {EQUIPMENT_LABEL[ex.equipment]} · техника
              </button>
            </div>
            <div className="relative grid h-14 w-14 shrink-0 place-items-center" aria-label={`Подход ${Math.min(done + 1, item.planned.sets)} из ${item.planned.sets}`}>
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-line)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-lime)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(done / item.planned.sets) * 97.4} 97.4`} />
              </svg>
              <span className="num text-xl">{done + 1}/{item.planned.sets}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <MuscleMap primary={ex.primary} secondary={ex.secondary} className="h-24 w-14 shrink-0 rounded-xl bg-surface p-1" />
            <div className="text-sm text-mute">
              <div className="text-xs font-bold uppercase tracking-wider">Цель</div>
              <div className="num text-4xl text-ink/70">
                {item.planned.repMin}–{item.planned.repMax} <span className="text-2xl">{ex.timed ? 'сек' : '×'}</span>
              </div>
              <div>запас {item.planned.rir} повт.</div>
            </div>
            {exSets.length > 0 || prevSets.length > 0 ? (
              <div className="ml-auto text-right text-xs text-mute">
                <div className="font-bold uppercase tracking-wider">{exSets.length ? 'Сейчас' : 'Прошлый раз'}</div>
                {(exSets.length ? exSets : prevSets).slice(0, 5).map((x, i) => (
                  <div key={i} className="num text-xl text-ink">{formatKg(x.weight)}×{x.reps}</div>
                ))}
              </div>
            ) : null}
          </div>

          {/* вес — главный элемент */}
          <div className="mt-6 rounded-[1.5rem] bg-surface p-4">
            {weight === null ? (
              <div className="py-4 text-center">
                <p className="mb-3 text-mute">Рабочий вес ещё не подобран.</p>
                <Button variant="primary" onClick={() => setCalc(true)}>Подобрать вес</Button>
                <button className="mt-3 block w-full text-sm font-bold text-mute" onClick={() => setWeight(ex.bar || ex.step)}>
                  Ввести вручную
                </button>
              </div>
            ) : (
              <>
                <Stepper big label="Вес" value={weight} onChange={setWeight} step={ex.step} unit="кг" />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm font-bold text-mute">{ex.timed ? 'Сек' : 'Повт.'}</span>
                  <Stepper label="Повторения" value={reps} onChange={setReps} step={ex.timed ? 5 : 1} min={1} max={100} />
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <span className="mr-auto text-sm font-bold text-mute">В запасе</span>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <Chip key={n} active={rir === n} onClick={() => setRir(n)} className="w-11 px-0">
                      {n === 4 ? '4+' : n}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </div>
          {hint && <p className="mt-2 text-sm text-mute">{hint}</p>}
          {item.suggestedWeight !== null && done === 0 && (
            <p className="mt-2 text-sm text-mute">{s.recommendation(item.exerciseId, item.planned).explanation}</p>
          )}
          {error && <div role="alert" className="mt-2 text-sm font-bold text-danger">{error}</div>}

          {exSets.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto">
              {exSets.map((x, i) => (
                <span key={x.id} className="num shrink-0 rounded-full bg-surface px-3 py-1 text-lg">
                  {i + 1}: {formatKg(x.weight)}×{x.reps}
                </span>
              ))}
              <button aria-label="Отменить последний подход" onClick={() => s.undoLastSet(item.exerciseId)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-mute hover:text-ink">
                <Undo2 size={16} />
              </button>
            </div>
          )}

          <div className="mt-auto pt-6">
            {restEnd && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-surface p-3" role="timer" aria-live="off">
                <div className={`num text-5xl ${restLeft === 0 ? 'text-lime' : ''}`}>{formatDuration(restLeft * 1000)}</div>
                <div className="text-xs font-bold text-mute">{restLeft === 0 ? 'Отдых закончен' : 'отдых'}</div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => setRestEnd((e) => (e ?? Date.now()) + 15000)}>+15</Button>
                  <Button size="sm" onClick={() => setRestEnd(null)}>Пропустить</Button>
                </div>
              </div>
            )}
            <button
              onClick={log}
              disabled={weight === null}
              className="flex h-20 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-2xl font-extrabold text-bg transition active:scale-[0.98] disabled:opacity-40"
            >
              <Check size={28} strokeWidth={3} /> Записать подход
            </button>
            {done >= item.planned.sets - 1 && done > 0 && <div className="sr-only">Последний подход</div>}
          </div>
        </>
      )}

      {/* меню */}
      <Modal open={menu} onClose={() => setMenu(false)} title="Тренировка">
        <div className="space-y-2">
          <Label>Упражнения</Label>
          {a.exercises.map((e, i) => (
            <button
              key={i}
              onClick={() => { setSel(i); setMenu(false) }}
              className={`flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left ${i === cur ? 'ring-1 ring-lime' : ''}`}
            >
              <span className={e.skipped ? 'text-mute line-through' : ''}>{getExercise(e.exerciseId).name}</span>
              <span className="num text-xl text-mute">{counts[i]}/{e.planned.sets}</span>
            </button>
          ))}
          {item && (
            <div className="grid grid-cols-2 gap-2 pt-3">
              <Button onClick={() => { setMenu(false); setReplace(true) }}>Заменить</Button>
              <Button onClick={() => { s.skipExercise(cur, true); setSel(null); setMenu(false) }}>Пропустить</Button>
              <Button onClick={() => s.flagExercise(item.exerciseId, a.flags[item.exerciseId] === 'form' ? undefined : 'form')} className={a.flags[item.exerciseId] === 'form' ? 'border-lime text-lime' : ''}>
                Техника страдает
              </Button>
              <Button variant="danger" onClick={() => s.flagExercise(item.exerciseId, a.flags[item.exerciseId] === 'pain' ? undefined : 'pain')}>
                {a.flags[item.exerciseId] === 'pain' ? 'Боль отмечена' : 'Боль'}
              </Button>
              <Button className="col-span-2" onClick={() => { setMenu(false); setCalc(true) }}>Калькулятор веса</Button>
            </div>
          )}
          {a.exercises.some((e) => e.skipped) && (
            <Button className="w-full" onClick={() => a.exercises.forEach((e, i) => e.skipped && s.skipExercise(i, false))}>
              Вернуть пропущенные
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2 pt-3">
            <Button variant="danger" onClick={() => setConfirm('discard')}>Отменить тренировку</Button>
            <Button variant="primary" onClick={() => (a.sets.length === 0 ? setConfirm('discard') : setConfirm('finish'))}>Завершить</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm === 'discard'}
        title="Отменить тренировку?"
        text="Записанные подходы этой тренировки не сохранятся."
        confirmLabel="Отменить"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { s.discardSession(); setConfirm(null); setMenu(false) }}
      />
      <ConfirmDialog
        open={confirm === 'finish'}
        title="Завершить тренировку?"
        text={`Записано подходов: ${a.sets.length}. Невыполненные упражнения останутся пустыми.`}
        confirmLabel="Завершить"
        onCancel={() => setConfirm(null)}
        onConfirm={finish}
      />

      <Modal open={replace} onClose={() => setReplace(false)} title="Заменить упражнение">
        <div className="space-y-2">
          {item && alternativesFor(item.exerciseId, data.profile).length === 0 && <p className="text-mute">Подходящих замен нет.</p>}
          {item && alternativesFor(item.exerciseId, data.profile).map((o) => (
            <button key={o.id} onClick={() => { s.replaceExercise(cur, o.id); setReplace(false) }} className="flex w-full flex-col rounded-2xl bg-surface px-4 py-3 text-left hover:bg-surface-2">
              <span className="font-bold">{o.name}</span>
              <span className="text-xs text-mute">{EQUIPMENT_LABEL[o.equipment]} · килограммы не равны прежнему упражнению — вес подберите заново</span>
            </button>
          ))}
        </div>
      </Modal>

      {item && (
        <WeightCalculator
          exerciseId={item.exerciseId}
          planned={item.planned}
          open={calc}
          onClose={() => setCalc(false)}
          onApply={(w) => { setWeight(w); s.setWorkingWeight(item.exerciseId, w) }}
        />
      )}
      <ExerciseDetail id={tech && item ? item.exerciseId : null} onClose={() => setTech(false)} />
    </div>
  )
}
