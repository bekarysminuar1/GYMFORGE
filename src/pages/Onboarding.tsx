import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { Button, Chip, Label, NumberField } from '../components/ui'
import { profileSchema } from '../lib/schemas'
import { generateProgram, recommendSplit, SPLIT_LABEL } from '../lib/program'
import { EQUIPMENT_LABEL, EXERCISES } from '../data/exercises'
import type { Equipment, Goal, Level, Profile, SplitType } from '../lib/types'

const GOALS: [Goal, string][] = [
  ['muscle', 'Набор массы'],
  ['fat_loss', 'Снижение жира'],
  ['strength', 'Сила'],
  ['general', 'Общая форма'],
]
const LEVELS: [Level, string][] = [
  ['beginner', 'Новичок'],
  ['intermediate', 'Средний'],
  ['advanced', 'Продвинутый'],
]
const LIMITS = [
  ['shoulder', 'Плечо'],
  ['knee', 'Колено'],
  ['back', 'Спина'],
  ['wrist', 'Запястье'],
  ['elbow', 'Локоть'],
] as const

type Form = {
  age: number | ''
  sex: Profile['sex']
  heightCm: number | ''
  weightKg: number | ''
  level: Level
  experienceMonths: number | ''
  goal: Goal
  daysPerWeek: number
  sessionMinutes: number | ''
  equipment: Equipment[]
  preferred: string[]
  limitations: Profile['limitations']
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export default function Onboarding() {
  const { saveProfile, addProgram } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [split, setSplit] = useState<SplitType | null>(null)
  const [f, setF] = useState<Form>({
    age: '',
    sex: '',
    heightCm: '',
    weightKg: '',
    level: 'beginner',
    experienceMonths: 0,
    goal: 'muscle',
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipment: ['stack_machine', 'plate_machine', 'cable', 'dumbbell', 'bodyweight'],
    preferred: [],
    limitations: [],
  })
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((o) => ({ ...o, [k]: v }))

  const validateStep = (s: number) => {
    const r = profileSchema.safeParse(f)
    const fields: Record<number, string[]> = {
      0: ['age', 'heightCm', 'weightKg'],
      1: ['level', 'experienceMonths', 'goal'],
      2: ['daysPerWeek', 'sessionMinutes', 'equipment'],
      3: [],
    }
    const errs: Record<string, string> = {}
    if (!r.success)
      for (const i of r.error.issues) {
        const k = String(i.path[0])
        if (fields[s].includes(k) && !errs[k]) errs[k] = i.message
      }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => validateStep(step) && setStep(step + 1)

  const finish = () => {
    const r = profileSchema.safeParse(f)
    if (!r.success) {
      setErrors({ form: r.error.issues[0].message })
      return
    }
    const profile = r.data as Profile
    saveProfile(profile)
    addProgram(generateProgram(profile, split ?? recommendSplit(profile)), true)
    nav('/')
  }

  const rec = recommendSplit({ daysPerWeek: f.daysPerWeek, level: f.level })

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 py-8">
      <div className="num text-4xl text-lime">GYMFORGE</div>
      <div className="mt-2 flex gap-1.5" aria-label={`Шаг ${step + 1} из 4`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-lime' : 'bg-line'}`} />
        ))}
      </div>

      <div className="rise mt-8 space-y-6" key={step}>
        {step === 0 && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Расскажите о себе</h1>
            <p className="text-mute">Это нужно, чтобы собрать программу под вас, а не выдать шаблон.</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Возраст" value={f.age} onChange={(v) => set('age', v)} error={errors.age} suffix="лет" />
              <div>
                <Label>Пол (по желанию)</Label>
                <select
                  value={f.sex}
                  onChange={(e) => set('sex', e.target.value as Profile['sex'])}
                  className="h-12 w-full rounded-2xl bg-surface px-4 font-semibold"
                >
                  <option value="">Не указывать</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <NumberField label="Рост" value={f.heightCm} onChange={(v) => set('heightCm', v)} error={errors.heightCm} suffix="см" />
              <NumberField label="Вес тела" value={f.weightKg} onChange={(v) => set('weightKg', v)} error={errors.weightKg} suffix="кг" />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Уровень и цель</h1>
            <div>
              <Label>Уровень подготовки</Label>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map(([v, l]) => (
                  <Chip key={v} active={f.level === v} onClick={() => set('level', v)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
            <NumberField
              label="Опыт тренировок"
              value={f.experienceMonths}
              onChange={(v) => set('experienceMonths', v)}
              error={errors.experienceMonths}
              suffix="мес."
            />
            <div>
              <Label>Основная цель</Label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(([v, l]) => (
                  <Chip key={v} active={f.goal === v} onClick={() => set('goal', v)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Расписание и зал</h1>
            <div>
              <Label>Тренировочных дней в неделю</Label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <Chip key={n} active={f.daysPerWeek === n} onClick={() => set('daysPerWeek', n)} className="flex-1">
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
            <NumberField
              label="Длительность тренировки"
              value={f.sessionMinutes}
              onChange={(v) => set('sessionMinutes', v)}
              error={errors.sessionMinutes}
              suffix="мин"
            />
            <div>
              <Label>Доступное оборудование</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EQUIPMENT_LABEL) as Equipment[])
                  .filter((e) => e !== 'cardio')
                  .map((e) => (
                    <Chip key={e} active={f.equipment.includes(e)} onClick={() => set('equipment', toggle(f.equipment, e))}>
                      {EQUIPMENT_LABEL[e]}
                    </Chip>
                  ))}
              </div>
              {errors.equipment && <div className="mt-1 text-xs font-semibold text-danger">{errors.equipment}</div>}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Ограничения и предпочтения</h1>
            <div>
              <Label>Травмы / зоны, которые нужно беречь</Label>
              <div className="flex flex-wrap gap-2">
                {LIMITS.map(([v, l]) => (
                  <Chip key={v} active={f.limitations.includes(v)} onClick={() => set('limitations', toggle(f.limitations, v))}>
                    {l}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-xs text-mute">
                Упражнения, нагружающие эти зоны, не попадут в программу. Это не медицинская рекомендация — при травмах
                проконсультируйтесь с врачом.
              </p>
            </div>
            <div>
              <Label>Любимые упражнения (приоритет при подборе)</Label>
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {EXERCISES.filter((e) => e.equipment !== 'cardio' && f.equipment.includes(e.equipment)).map((e) => (
                  <Chip key={e.id} active={f.preferred.includes(e.id)} onClick={() => set('preferred', toggle(f.preferred, e.id))}>
                    {e.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Тип программы</Label>
              <div className="flex flex-wrap gap-2">
                {(['full_body', 'upper_lower', 'ppl', 'bro_split'] as SplitType[]).map((s) => (
                  <Chip key={s} active={(split ?? rec) === s} onClick={() => setSplit(s)}>
                    {SPLIT_LABEL[s]}
                    {s === rec ? ' ★' : ''}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-xs text-mute">★ — рекомендуем для {f.daysPerWeek} дн/нед и вашего уровня.</p>
            </div>
            {errors.form && <div className="text-sm font-semibold text-danger">{errors.form}</div>}
          </>
        )}
      </div>

      <div className="mt-10 flex gap-3">
        {step > 0 && (
          <Button size="lg" onClick={() => setStep(step - 1)} aria-label="Назад">
            Назад
          </Button>
        )}
        {step < 3 ? (
          <Button size="lg" variant="primary" className="flex-1" onClick={next}>
            Далее
          </Button>
        ) : (
          <Button size="lg" variant="primary" className="flex-1" onClick={finish}>
            Создать программу
          </Button>
        )}
      </div>
    </div>
  )
}
