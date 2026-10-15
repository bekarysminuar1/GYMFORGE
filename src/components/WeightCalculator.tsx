import { useMemo, useState } from 'react'
import { Button, Chip, Label, Modal, Stepper } from './ui'
import { useStore } from '../store/AppStore'
import { getExercise } from '../data/exercises'
import {
  beginnerFindingProcedure,
  best1RM,
  clampWeight,
  roundToStep,
  suggestFromTestSet,
  weightForReps,
} from '../lib/calc'
import { testSetSchema } from '../lib/schemas'
import { formatKg } from '../lib/stats'
import type { PlannedExercise } from '../lib/types'

type Tab = 'history' | 'test' | 'table' | 'start'
const TABS: [Tab, string][] = [
  ['history', 'История'],
  ['test', 'Тест-подход'],
  ['table', '1RM'],
  ['start', 'Подбор с нуля'],
]

export default function WeightCalculator({
  exerciseId,
  planned,
  open,
  onClose,
  onApply,
}: {
  exerciseId: string
  planned: PlannedExercise
  open: boolean
  onClose: () => void
  onApply: (w: number) => void
}) {
  const { recommendation, lastSetsFor, data } = useStore()
  const ex = getExercise(exerciseId)
  const last = lastSetsFor(exerciseId)
  const [tab, setTab] = useState<Tab>(last.length ? 'history' : 'start')
  const [w, setW] = useState(data.workingWeights[exerciseId] ?? ex.step * 4)
  const [reps, setReps] = useState(10)
  const [rir, setRir] = useState(2)
  const [err, setErr] = useState('')
  const rec = useMemo(() => recommendation(exerciseId, planned), [recommendation, exerciseId, planned])
  const unit = ex.timed ? 'сек' : 'повт'

  const test = useMemo(() => {
    const r = testSetSchema.safeParse({ weight: w, reps, rir })
    if (!r.success) return { error: r.error.issues[0].message }
    return { s: suggestFromTestSet(ex, r.data, planned, data.profile?.level === 'beginner') }
  }, [w, reps, rir, ex, planned, data.profile?.level])

  const oneRm = best1RM(last)
  const apply = (v: number) => {
    onApply(clampWeight(roundToStep(v, ex.step), ex))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Рабочий вес · ${ex.name}`}>
      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map(([k, l]) => (
          <Chip key={k} active={tab === k} onClick={() => setTab(k)}>
            {l}
          </Chip>
        ))}
      </div>

      {tab === 'history' &&
        (last.length === 0 ? (
          <p className="text-mute">Истории по этому упражнению пока нет. Используйте тест-подход или подбор с нуля.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Прошлый раз</Label>
              <div className="num text-3xl">{last.map((s) => `${formatKg(s.weight)}×${s.reps}`).join('  ·  ')}</div>
            </div>
            <div className="rounded-2xl bg-surface p-4">
              <Label>Рекомендация</Label>
              {rec.weight !== null ? (
                <div className="num text-6xl text-lime">
                  {formatKg(rec.weight)}
                  <span className="ml-1 text-xl text-mute">кг</span>
                </div>
              ) : (
                <div className="text-mute">Нет числа — подберите вес вручную.</div>
              )}
              <p className="mt-2 text-sm text-mute">{rec.explanation}</p>
            </div>
            {rec.weight !== null && (
              <Button variant="primary" size="lg" className="w-full" onClick={() => apply(rec.weight!)}>
                Взять {formatKg(rec.weight)} кг
              </Button>
            )}
          </div>
        ))}

      {tab === 'test' && (
        <div className="space-y-5">
          <p className="text-sm text-mute">
            Сделайте подход с комфортным весом, не до отказа, и укажите результат. Мы оценим 1RM по формуле Эпли и
            предложим рабочий вес.
          </p>
          <div>
            <Label>Вес снаряда, кг</Label>
            <Stepper label="Вес" value={w} onChange={setW} step={ex.step} unit="кг" />
          </div>
          <div>
            <Label>Выполнено ({unit})</Label>
            <Stepper label="Повторения" value={reps} onChange={setReps} step={1} min={1} max={30} />
          </div>
          <div>
            <Label>Сколько повторений оставалось в запасе (RIR)</Label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((n) => (
                <Chip key={n} active={rir === n} onClick={() => setRir(n)} className="flex-1">
                  {n === 4 ? '4+' : n}
                </Chip>
              ))}
            </div>
          </div>
          {'error' in test ? (
            <div className="text-sm font-semibold text-danger" role="alert">
              {test.error}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface p-4">
              <Label>Предварительный рабочий вес</Label>
              <div className="num text-6xl text-lime">
                {formatKg(test.s!.weight)}
                <span className="ml-1 text-xl text-mute">кг</span>
              </div>
              <p className="mt-2 text-sm text-mute">{test.s!.explanation}</p>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={'error' in test}
            onClick={() => {
              if ('error' in test) return setErr(test.error ?? '')
              apply(test.s!.weight)
            }}
          >
            Применить
          </Button>
          {err && <div className="text-sm text-danger">{err}</div>}
        </div>
      )}

      {tab === 'table' && (
        <div className="space-y-3">
          {oneRm ? (
            <>
              <div className="text-sm text-mute">
                Расчётный 1RM по лучшему подходу (формула Эпли):{' '}
                <b className="text-ink">{formatKg(Math.round(oneRm * 10) / 10)} кг</b>. Это оценка, а не гарантия. Не
                проверяйте максимум без опыта и страховки.
              </div>
              <div className="divide-y divide-line rounded-2xl bg-surface">
                {[3, 5, 8, 10, 12, 15].map((r) => (
                  <button
                    key={r}
                    onClick={() => apply(weightForReps(oneRm, r + planned.rir))}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2"
                  >
                    <span className="text-mute">
                      {r} {unit} с запасом {planned.rir}
                    </span>
                    <span className="num text-2xl">
                      {formatKg(clampWeight(roundToStep(weightForReps(oneRm, r + planned.rir), ex.step, 'down'), ex))} кг
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-mute">
              Для расчёта 1RM нужен хотя бы один подход до 12 повторений в истории. Сделайте тест-подход.
            </p>
          )}
        </div>
      )}

      {tab === 'start' && (
        <div className="space-y-3">
          <p className="text-sm text-mute">
            Без истории мы не угадываем число по росту и весу тела. Подберите вес так:
          </p>
          <ol className="space-y-2">
            {beginnerFindingProcedure(ex).steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-surface p-3 text-sm">
                <span className="num text-2xl text-lime">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <Button className="w-full" onClick={() => setTab('test')}>
            Ввести результат как тест-подход
          </Button>
        </div>
      )}
    </Modal>
  )
}
