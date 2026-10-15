import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, Plus, Replace, Trash2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, Chip, ConfirmDialog, EmptyState, Label, Modal, Stepper } from '../components/ui'
import WeightCalculator from '../components/WeightCalculator'
import { EQUIPMENT_LABEL, EXERCISES, MUSCLE_LABEL, getExercise } from '../data/exercises'
import { SPLIT_LABEL, alternativesFor, estimateMinutes, generateProgram, isAllowed, makePlanned, recommendSplit, uid, weeklySets } from '../lib/program'
import { formatKg } from '../lib/stats'
import type { Muscle, PlannedExercise, Program, ProgramDay, SplitType } from '../lib/types'

export default function ProgramPage() {
  const s = useStore()
  const { data, activeProgram: prog } = s
  const nav = useNavigate()
  const [open, setOpen] = useState<string | null>(null)
  const [gen, setGen] = useState(false)
  const [split, setSplit] = useState<SplitType>(data.profile ? recommendSplit(data.profile) : 'full_body')
  const [del, setDel] = useState(false)
  const [picker, setPicker] = useState<{ dayId: string; replaceIdx: number | null } | null>(null)
  const [calc, setCalc] = useState<{ id: string; planned: PlannedExercise } | null>(null)

  const save = (p: Program) => s.updateProgram(p)
  const patchDay = (dayId: string, fn: (d: ProgramDay) => ProgramDay) =>
    prog && save({ ...prog, days: prog.days.map((d) => (d.id === dayId ? fn(d) : d)) })
  const patchEx = (dayId: string, i: number, patch: Partial<PlannedExercise>) =>
    patchDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((e, k) => (k === i ? { ...e, ...patch } : e)) }))

  const regenerate = () => {
    if (!data.profile) return
    s.addProgram(generateProgram(data.profile, split), true)
    setGen(false)
  }

  const header = (
    <div className="flex items-end justify-between">
      <h1 className="num text-5xl">Программа</h1>
      <Button size="sm" onClick={() => setGen(true)}>
        <Plus size={16} /> Новая
      </Button>
    </div>
  )

  const genModal = (
    <Modal open={gen} onClose={() => setGen(false)} title="Новая программа">
      <p className="mb-3 text-sm text-mute">Программа собирается по вашему профилю: цель, уровень, дни, время, оборудование и ограничения.</p>
      <Label>Тип</Label>
      <div className="mb-5 flex flex-wrap gap-2">
        {(['full_body', 'upper_lower', 'ppl', 'bro_split'] as SplitType[]).map((k) => (
          <Chip key={k} active={split === k} onClick={() => setSplit(k)}>
            {SPLIT_LABEL[k]}
          </Chip>
        ))}
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={regenerate} disabled={!data.profile}>
        Создать
      </Button>
    </Modal>
  )

  if (!prog)
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title="Программы нет" text="Создайте её по вашему профилю." />
        {genModal}
      </div>
    )

  const vol = weeklySets(prog)
  const volRows = (Object.entries(vol) as [Muscle, number][]).sort((a, b) => b[1] - a[1])
  const maxVol = Math.max(...volRows.map((r) => r[1]), 12)

  return (
    <div className="space-y-6">
      {header}
      <div>
        <div className="text-lg font-extrabold">{prog.name}</div>
        {data.programs.length > 1 && (
          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
            {data.programs.map((p) => (
              <Chip key={p.id} active={p.id === prog.id} onClick={() => s.setActiveProgram(p.id)}>
                {p.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <section className="rounded-[1.25rem] bg-surface p-4">
        <Label>Подходов в неделю на мышцу</Label>
        <div className="space-y-1.5">
          {volRows.map(([m, n]) => (
            <div key={m} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-mute">{MUSCLE_LABEL[m]}</span>
              <div className="h-2 flex-1 rounded-full bg-line">
                <div className={`h-2 rounded-full ${n > 20 ? 'bg-danger' : 'bg-lime'}`} style={{ width: `${(n / maxVol) * 100}%` }} />
              </div>
              <span className="num w-6 text-right text-lg">{n}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-mute">Ориентир для большинства — 10–20 рабочих подходов на мышцу в неделю. Больше 20 помечается красным.</p>
      </section>

      <div className="space-y-3">
        {prog.days.map((d) => {
          const isOpen = open === d.id
          return (
            <section key={d.id} className="rounded-[1.25rem] bg-surface">
              <button onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <div>
                  <div className="num text-4xl leading-none">{d.name}</div>
                  <div className="mt-1 text-xs text-mute">
                    {[...new Set(d.focus)].map((m) => MUSCLE_LABEL[m]).join(' · ')} · {d.exercises.length} упр. · ~{estimateMinutes(d.exercises)} мин
                  </div>
                </div>
                <ChevronDown className={`shrink-0 text-mute transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-line p-4">
                  <input
                    aria-label="Название дня"
                    value={d.name}
                    onChange={(e) => patchDay(d.id, (x) => ({ ...x, name: e.target.value }))}
                    className="h-10 w-full rounded-xl bg-bg px-3 font-bold outline-none focus:ring-2 focus:ring-lime"
                  />
                  {d.exercises.length === 0 && <p className="text-sm text-mute">В этом дне нет упражнений.</p>}
                  {d.exercises.map((pe, i) => {
                    const ex = getExercise(pe.exerciseId)
                    const w = data.workingWeights[pe.exerciseId]
                    return (
                      <div key={i} className="rounded-2xl bg-bg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold">{ex.name}</div>
                            <div className="text-xs text-mute">{EQUIPMENT_LABEL[ex.equipment]}</div>
                          </div>
                          <button onClick={() => setCalc({ id: pe.exerciseId, planned: pe })} className="text-right">
                            <div className="num text-3xl leading-none text-lime">{w ? formatKg(w) : '—'}</div>
                            <div className="text-[11px] font-bold text-mute">{w ? 'кг · изменить' : 'подобрать'}</div>
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-mute">
                          <div>
                            Подходы
                            <Stepper label="Подходы" value={pe.sets} onChange={(v) => patchEx(d.id, i, { sets: v })} min={1} max={8} />
                          </div>
                          <div>
                            Повт. от
                            <Stepper label="Повторения от" value={pe.repMin} onChange={(v) => patchEx(d.id, i, { repMin: v, repMax: Math.max(v, pe.repMax) })} min={1} max={100} step={ex.timed ? 5 : 1} />
                          </div>
                          <div>
                            до
                            <Stepper label="Повторения до" value={pe.repMax} onChange={(v) => patchEx(d.id, i, { repMax: v, repMin: Math.min(v, pe.repMin) })} min={1} max={100} step={ex.timed ? 5 : 1} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-mute">Отдых {pe.restSec} с</span>
                          <div className="flex gap-1">
                            <button aria-label="Меньше отдыха" className="rounded-lg bg-surface px-2 py-1 text-xs font-bold" onClick={() => patchEx(d.id, i, { restSec: Math.max(15, pe.restSec - 15) })}>−15</button>
                            <button aria-label="Больше отдыха" className="rounded-lg bg-surface px-2 py-1 text-xs font-bold" onClick={() => patchEx(d.id, i, { restSec: Math.min(300, pe.restSec + 15) })}>+15</button>
                            <button aria-label="Вверх" disabled={i === 0} className="rounded-lg bg-surface p-1.5 disabled:opacity-30" onClick={() => patchDay(d.id, (x) => { const e = [...x.exercises]; [e[i - 1], e[i]] = [e[i], e[i - 1]]; return { ...x, exercises: e } })}><ArrowUp size={14} /></button>
                            <button aria-label="Вниз" disabled={i === d.exercises.length - 1} className="rounded-lg bg-surface p-1.5 disabled:opacity-30" onClick={() => patchDay(d.id, (x) => { const e = [...x.exercises]; [e[i + 1], e[i]] = [e[i], e[i + 1]]; return { ...x, exercises: e } })}><ArrowDown size={14} /></button>
                            <button aria-label="Заменить упражнение" className="rounded-lg bg-surface p-1.5" onClick={() => setPicker({ dayId: d.id, replaceIdx: i })}><Replace size={14} /></button>
                            <button aria-label="Удалить упражнение" className="rounded-lg bg-surface p-1.5 text-danger" onClick={() => patchDay(d.id, (x) => ({ ...x, exercises: x.exercises.filter((_, k) => k !== i) }))}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => setPicker({ dayId: d.id, replaceIdx: null })}>
                      <Plus size={16} /> Упражнение
                    </Button>
                    <Button
                      variant="danger"
                      aria-label="Удалить день"
                      onClick={() => prog.days.length > 1 && save({ ...prog, days: prog.days.filter((x) => x.id !== d.id) })}
                      disabled={prog.days.length <= 1}
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Button
                      variant="primary"
                      disabled={d.exercises.length === 0 || !!data.activeSession}
                      onClick={() => { s.startSession(prog.id, d.id); nav('/workout') }}
                    >
                      Начать
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )
        })}
        <Button
          className="w-full"
          onClick={() => {
            const id = uid()
            save({ ...prog, days: [...prog.days, { id, name: `День ${prog.days.length + 1}`, focus: [], exercises: [] }] })
            setOpen(id)
          }}
        >
          <Plus size={16} /> Свой тренировочный день
        </Button>
        <Button variant="danger" className="w-full" onClick={() => setDel(true)}>
          Удалить программу
        </Button>
      </div>

      {genModal}
      <ConfirmDialog
        open={del}
        title="Удалить программу?"
        text="История выполненных тренировок сохранится."
        confirmLabel="Удалить"
        onCancel={() => setDel(false)}
        onConfirm={() => { s.deleteProgram(prog.id); setDel(false) }}
      />

      <Modal open={!!picker} onClose={() => setPicker(null)} title={picker?.replaceIdx != null ? 'Заменить упражнение' : 'Добавить упражнение'}>
        {picker && (() => {
          const day = prog.days.find((x) => x.id === picker.dayId)!
          const list =
            picker.replaceIdx != null
              ? alternativesFor(day.exercises[picker.replaceIdx].exerciseId, data.profile)
              : EXERCISES.filter((e) => e.equipment !== 'cardio' && (!data.profile || isAllowed(e, data.profile)))
          return (
            <div className="space-y-2">
              {list.length === 0 && <p className="text-mute">Подходящих упражнений нет.</p>}
              {list.map((e) => (
                <button
                  key={e.id}
                  className="flex w-full flex-col rounded-2xl bg-surface px-4 py-3 text-left hover:bg-surface-2"
                  onClick={() => {
                    const pe = makePlanned(e, data.profile)
                    patchDay(picker.dayId, (x) => ({
                      ...x,
                      focus: x.focus.length ? x.focus : e.primary,
                      exercises:
                        picker.replaceIdx != null
                          ? x.exercises.map((o, k) => (k === picker.replaceIdx ? pe : o))
                          : [...x.exercises, pe],
                    }))
                    setPicker(null)
                  }}
                >
                  <span className="font-bold">{e.name}</span>
                  <span className="text-xs text-mute">{EQUIPMENT_LABEL[e.equipment]} · {e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</span>
                </button>
              ))}
            </div>
          )
        })()}
      </Modal>

      {calc && (
        <WeightCalculator
          exerciseId={calc.id}
          planned={calc.planned}
          open
          onClose={() => setCalc(null)}
          onApply={(w) => s.setWorkingWeight(calc.id, w)}
        />
      )}
    </div>
  )
}
