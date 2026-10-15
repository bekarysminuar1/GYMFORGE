import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Chip, EmptyState } from '../components/ui'
import MuscleMap from '../components/MuscleMap'
import ExerciseDetail from '../components/ExerciseDetail'
import { EQUIPMENT_LABEL, EXERCISES, MUSCLE_LABEL } from '../data/exercises'
import type { Equipment, Muscle } from '../lib/types'

export default function ExercisesPage() {
  const [q, setQ] = useState('')
  const [eq, setEq] = useState<Equipment | null>(null)
  const [mu, setMu] = useState<Muscle | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return EXERCISES.filter(
      (e) =>
        (!s || e.name.toLowerCase().includes(s) || e.nameEn.toLowerCase().includes(s)) &&
        (!eq || e.equipment === eq) &&
        (!mu || e.primary.includes(mu) || e.secondary.includes(mu)),
    )
  }, [q, eq, mu])
  const muscles = (Object.keys(MUSCLE_LABEL) as Muscle[]).filter((m) => m !== 'cardio')
  return (
    <div className="space-y-5">
      <h1 className="num text-5xl">Упражнения</h1>
      <label className="flex h-12 items-center gap-3 rounded-2xl bg-surface px-4 focus-within:ring-2 focus-within:ring-lime">
        <Search size={18} className="text-mute" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию"
          aria-label="Поиск упражнений"
          className="w-full bg-transparent outline-none"
        />
      </label>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={!eq} onClick={() => setEq(null)}>
          Всё
        </Chip>
        {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => (
          <Chip key={k} active={eq === k} onClick={() => setEq(eq === k ? null : k)}>
            {EQUIPMENT_LABEL[k]}
          </Chip>
        ))}
      </div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {muscles.map((m) => (
          <Chip key={m} active={mu === m} onClick={() => setMu(mu === m ? null : m)}>
            {MUSCLE_LABEL[m]}
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Ничего не найдено" text="Сбросьте фильтры или измените запрос." />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((e) => (
            <li key={e.id}>
              <button onClick={() => setOpen(e.id)} className="flex w-full items-center gap-4 py-3 text-left">
                <MuscleMap primary={e.primary} secondary={e.secondary} className="h-20 w-14 shrink-0 rounded-xl bg-surface p-1" />
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{e.name}</div>
                  <div className="text-xs text-mute">{e.nameEn}</div>
                  <div className="mt-1 text-sm text-mute">
                    {EQUIPMENT_LABEL[e.equipment]} · {e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ExerciseDetail id={open} onClose={() => setOpen(null)} />
    </div>
  )
}
