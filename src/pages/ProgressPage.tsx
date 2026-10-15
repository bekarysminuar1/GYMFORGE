import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Dot, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trophy } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, Chip, EmptyState, Label, NumberField } from '../components/ui'
import { EXERCISES, MUSCLE_LABEL, getExercise } from '../data/exercises'
import { sessionVolume } from '../lib/calc'
import { bodyWeightSchema } from '../lib/schemas'
import {
  adherence,
  dayKey,
  exerciseSeries,
  finishedSessions,
  formatKg,
  formatVolume,
  inRange,
  muscleSets,
  personalRecords,
  prsInSession,
  shortDate,
  weeklyVolume,
  type Metric,
  type Range,
} from '../lib/stats'
import type { Muscle } from '../lib/types'

const METRICS: [Metric, string, string][] = [
  ['weight', 'Вес', 'кг'],
  ['oneRm', '1RM', 'кг'],
  ['volume', 'Объём', 'кг'],
  ['reps', 'Повторения', ''],
]
const RANGES: Range[] = ['30D', '3M', '1Y', 'All']
const TT = { background: '#17191d', border: '1px solid #343840', borderRadius: 12, color: '#f3f4f6' }

export default function ProgressPage() {
  const { data, activeProgram, addBodyWeight, deleteBodyWeight } = useStore()
  const [tab, setTab] = useState<'strength' | 'history' | 'body'>('strength')
  const all = finishedSessions(data.sessions)
  const withData = useMemo(() => EXERCISES.filter((e) => all.some((s) => s.sets.some((x) => x.exerciseId === e.id))), [all])
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const choices = withData.filter((e) => !muscle || e.primary.includes(muscle))
  const [exId, setExId] = useState<string | null>(null)
  const sel = choices.find((e) => e.id === exId) ?? choices[0] ?? null
  const [metric, setMetric] = useState<Metric>('weight')
  const [range, setRange] = useState<Range>('3M')
  const [bw, setBw] = useState<number | ''>('')
  const [bwErr, setBwErr] = useState('')

  const pts = useMemo(() => (sel ? inRange(exerciseSeries(data.sessions, sel.id, metric), range) : []), [data.sessions, sel, metric, range])
  const best = pts.length ? Math.max(...pts.map((p) => p.value)) : null
  const delta = pts.length > 1 ? pts[pts.length - 1].value - pts[0].value : null
  const unit = METRICS.find((m) => m[0] === metric)![2]
  const prs = sel ? personalRecords(data.sessions, sel.id) : []
  const wv = weeklyVolume(data.sessions, 8)
  const ad = adherence(data.sessions, activeProgram, 4)
  const ms = (Object.entries(muscleSets(data.sessions, range)) as [Muscle, number][]).sort((a, b) => b[1] - a[1])

  if (all.length === 0 && data.body.length === 0)
    return (
      <div className="space-y-5">
        <h1 className="num text-5xl">Прогресс</h1>
        <EmptyState title="Данных пока нет" text="Завершите первую тренировку, и здесь появятся графики, рекорды и история." action={<Link to="/workout"><Button variant="primary">К тренировке</Button></Link>} />
      </div>
    )

  return (
    <div className="space-y-6">
      <h1 className="num text-5xl">Прогресс</h1>
      <div className="grid grid-cols-3 rounded-2xl bg-surface p-1" role="tablist">
        {([['strength', 'Силовые'], ['history', 'История'], ['body', 'Тело']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-10 rounded-xl text-sm font-bold ${tab === k ? 'bg-bg text-lime' : 'text-mute'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'strength' && (
        <>
          {withData.length === 0 ? (
            <EmptyState title="Нет силовых данных" text="Запишите подходы в тренировке." />
          ) : (
            <>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
                <Chip active={!muscle} onClick={() => setMuscle(null)}>Все мышцы</Chip>
                {[...new Set(withData.flatMap((e) => e.primary))].map((m) => (
                  <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{MUSCLE_LABEL[m]}</Chip>
                ))}
              </div>
              <select aria-label="Упражнение" value={sel?.id ?? ''} onChange={(e) => setExId(e.target.value)} className="h-12 w-full rounded-2xl bg-surface px-4 font-bold">
                {choices.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-2xl bg-surface p-1">
                  {RANGES.map((r) => (
                    <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} className={`h-9 rounded-xl px-3 text-sm font-bold ${range === r ? 'bg-bg text-lime' : 'text-mute'}`}>{r === 'All' ? 'Всё' : r}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {METRICS.map(([k, l]) => <Chip key={k} active={metric === k} onClick={() => setMetric(k)}>{l}</Chip>)}
              </div>
              <div>
                <div className="text-xs font-semibold text-mute">Лучшее значение за период</div>
                <div className="num text-7xl leading-none text-lime">
                  {best !== null ? formatKg(Math.round(best * 10) / 10) : '—'}
                  <span className="ml-1 text-2xl text-mute">{unit}</span>
                </div>
                {delta !== null && (
                  <div className="mt-1 text-sm text-mute">
                    {delta >= 0 ? '+' : ''}{formatKg(Math.round(delta * 10) / 10)} {unit} с начала периода
                  </div>
                )}
                {metric === 'oneRm' && <div className="mt-1 text-xs text-mute">Оценка по Эпли. Подходы длиннее 12 повторений не учитываются.</div>}
              </div>
              {pts.length === 0 ? (
                <EmptyState title="Нет данных за период" text={metric === 'oneRm' ? 'Для 1RM нужны подходы до 12 повторений.' : 'Выберите период шире.'} />
              ) : (
                <div className="h-60" aria-label="График прогресса">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pts} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="#343840" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v: string) => shortDate(v)} stroke="#a1a1aa" fontSize={11} tickLine={false} />
                      <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={TT} labelFormatter={(v) => shortDate(String(v))} formatter={(v) => [`${formatKg(Number(v))} ${unit}`, '']} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#C8FF36"
                        strokeWidth={3}
                        isAnimationActive={false}
                        dot={(p: { cx?: number; cy?: number; payload?: { pr: boolean }; index?: number }) =>
                          p.payload?.pr ? <Dot key={p.index} cx={p.cx} cy={p.cy} r={5} fill="#FF7547" stroke="#17191d" strokeWidth={2} /> : <Dot key={p.index} cx={p.cx} cy={p.cy} r={3} fill="#C8FF36" />
                        }
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {prs.length > 0 && (
                <section>
                  <h3 className="mb-2 text-lg font-extrabold">Личные рекорды</h3>
                  <div className="space-y-2">
                    {prs.map((p) => (
                      <div key={p.kind} className="flex items-center justify-between rounded-2xl bg-surface p-4">
                        <div className="flex items-center gap-2 text-ember">
                          <Trophy size={18} />
                          <span className="font-bold">{p.kind === 'weight' ? 'Макс. вес' : p.kind === 'oneRm' ? '1RM (оценка)' : 'Объём подхода'}</span>
                        </div>
                        <div className="text-right">
                          <div className="num text-3xl">{formatKg(p.value)} кг</div>
                          <div className="text-xs text-mute">{formatKg(p.set.weight)}×{p.set.reps} · {shortDate(p.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <section className="rounded-[1.25rem] bg-surface p-4">
            <div className="flex items-end justify-between">
              <Label>Тренировок по неделям</Label>
              {ad && <div className="text-sm text-mute">План за 4 нед: <b className="text-ink">{ad.done}/{ad.planned}</b> ({Math.round(ad.ratio * 100)}%)</div>}
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wv} margin={{ top: 5, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="#a1a1aa" fontSize={10} tickLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={10} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} cursor={{ fill: '#2a2e35' }} formatter={(v) => [String(v), 'тренировок']} />
                  <Bar dataKey="count" fill="#C8FF36" radius={4} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          {ms.length > 0 && (
            <section className="rounded-[1.25rem] bg-surface p-4">
              <Label>Подходов по мышцам ({range === 'All' ? 'всё время' : range})</Label>
              {ms.map(([m, n]) => (
                <div key={m} className="flex justify-between py-0.5 text-sm"><span className="text-mute">{MUSCLE_LABEL[m]}</span><span className="num text-lg">{n}</span></div>
              ))}
              <div className="mt-2 flex gap-2">{RANGES.map((r) => <Chip key={r} active={range === r} onClick={() => setRange(r)}>{r === 'All' ? 'Всё' : r}</Chip>)}</div>
            </section>
          )}
          <section className="space-y-2">
            {[...all].reverse().map((s) => {
              const prsHere = prsInSession(data.sessions, s)
              return (
                <details key={s.id} className="rounded-[1.25rem] bg-surface p-4">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between">
                    <span className="text-lg font-extrabold">{s.dayName}</span>
                    <span className="text-sm text-mute">{shortDate(s.startedAt)}</span>
                  </summary>
                  <div className="mt-1 flex gap-4 text-sm text-mute">
                    <span>{s.sets.length} подх.</span><span>{formatVolume(sessionVolume(s))}</span>
                    {prsHere.length > 0 && <span className="flex items-center gap-1 font-bold text-ember"><Trophy size={13} />{prsHere.length}</span>}
                  </div>
                  <div className="mt-3 space-y-2">
                    {[...new Set(s.sets.map((x) => x.exerciseId))].map((id) => (
                      <div key={id}>
                        <div className="text-sm font-bold">{getExercise(id).name}</div>
                        <div className="num text-xl text-mute">{s.sets.filter((x) => x.exerciseId === id).map((x) => `${formatKg(x.weight)}×${x.reps}`).join('  ·  ')}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
          </section>
        </>
      )}

      {tab === 'body' && (
        <>
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const r = bodyWeightSchema.safeParse(bw === '' ? NaN : bw)
              if (!r.success) return setBwErr(r.error.issues[0].message)
              setBwErr('')
              addBodyWeight(dayKey(new Date()), r.data)
              setBw('')
            }}
          >
            <div className="flex-1"><NumberField label="Вес тела сегодня" value={bw} onChange={setBw} suffix="кг" error={bwErr} /></div>
            <Button type="submit" variant="primary" className="h-12">Записать</Button>
          </form>
          {data.body.length < 2 ? (
            <EmptyState title="Нужно хотя бы два измерения" text="Динамика появится после второй записи." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.body} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#343840" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => shortDate(v)} stroke="#a1a1aa" fontSize={11} tickLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={11} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} labelFormatter={(v) => shortDate(String(v))} formatter={(v) => [`${v} кг`, '']} />
                  <Line type="monotone" dataKey="weightKg" stroke="#C8FF36" strokeWidth={3} dot={{ r: 3, fill: '#C8FF36' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="divide-y divide-line">
            {[...data.body].reverse().map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span className="text-mute">{shortDate(b.date)}</span>
                <span className="num text-2xl">{formatKg(b.weightKg)} кг</span>
                <button className="text-sm font-bold text-danger" onClick={() => deleteBodyWeight(b.id)}>Удалить</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
