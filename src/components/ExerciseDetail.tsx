import { useState } from 'react'
import { AlertTriangle, Trophy } from 'lucide-react'
import { Button, Label, Modal } from './ui'
import MuscleMap from './MuscleMap'
import WeightCalculator from './WeightCalculator'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, getExercise } from '../data/exercises'
import { dosage } from '../lib/program'
import { useStore } from '../store/AppStore'
import { personalRecords, formatKg } from '../lib/stats'

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <Label>{title}</Label>
    <div className="text-[15px] leading-relaxed">{children}</div>
  </section>
)

export default function ExerciseDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, setWorkingWeight } = useStore()
  const [calc, setCalc] = useState(false)
  if (!id) return null
  const ex = getExercise(id)
  const d = dosage(ex, data.profile ?? { goal: 'general', level: 'beginner' })
  const planned = { exerciseId: id, ...d }
  const w = data.workingWeights[id]
  const prs = personalRecords(data.sessions, id)
  const unit = ex.timed ? 'сек' : 'повт'
  return (
    <>
      <Modal open onClose={onClose} title={ex.name}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <MuscleMap primary={ex.primary} secondary={ex.secondary} view="both" className="h-40 w-auto rounded-2xl bg-surface p-2" />
            <div className="min-w-0 text-sm">
              <div className="text-mute">{ex.nameEn}</div>
              <div className="mt-1 font-bold">{EQUIPMENT_LABEL[ex.equipment]}</div>
              <div className="mt-2 text-mute">
                Основные: <span className="text-ink">{ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</span>
              </div>
              {ex.secondary.length > 0 && (
                <div className="text-mute">
                  Вспомогательные: <span className="text-ink">{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</span>
                </div>
              )}
              <div className="mt-2 text-xs text-mute">Схема мышц — иллюстрация. Видеодемонстрации в приложении нет.</div>
            </div>
          </div>

          <div className="flex items-end justify-between rounded-2xl bg-surface p-4">
            <div>
              <Label>Рекомендация</Label>
              <div className="font-bold">
                {d.sets} × {d.repMin}–{d.repMax} {unit} · отдых {d.restSec} с
              </div>
              <div className="text-xs text-mute">Запас повторений: {d.rir}</div>
            </div>
            <div className="text-right">
              <div className="num text-5xl leading-none">{w ? formatKg(w) : '—'}</div>
              <button className="text-sm font-bold text-lime" onClick={() => setCalc(true)}>
                {w ? 'Пересчитать вес' : 'Подобрать вес'}
              </button>
            </div>
          </div>

          <Sec title="Настройка">{ex.setup}</Sec>
          <Sec title="Исходная позиция">{ex.start}</Sec>
          <Sec title="Выполнение">
            <ol className="space-y-2">
              {ex.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num text-2xl leading-none text-lime">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Sec>
          <Sec title="Амплитуда">{ex.range}</Sec>
          <Sec title="Дыхание">{ex.breathing}</Sec>
          <Sec title="Частые ошибки">
            <ul className="list-disc space-y-1 pl-5 text-mute">
              {ex.mistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Sec>
          <div className="rounded-2xl border border-danger/40 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-danger">
              <AlertTriangle size={16} /> Безопасность
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ex.safety.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          {prs.length > 0 && (
            <Sec title="Ваши рекорды">
              {prs.map((p) => (
                <div key={p.kind} className="flex items-center gap-2 text-ember">
                  <Trophy size={16} />
                  {p.kind === 'weight' ? 'Вес' : p.kind === 'oneRm' ? '1RM ≈' : 'Объём подхода'}{' '}
                  <b>
                    {formatKg(p.value)} кг
                  </b>
                  <span className="text-xs text-mute">
                    ({formatKg(p.set.weight)}×{p.set.reps})
                  </span>
                </div>
              ))}
            </Sec>
          )}
          <Button className="w-full" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </Modal>
      <WeightCalculator
        exerciseId={id}
        planned={planned}
        open={calc}
        onClose={() => setCalc(false)}
        onApply={(v) => setWorkingWeight(id, v)}
      />
    </>
  )
}
