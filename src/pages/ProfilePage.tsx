import { useRef, useState } from 'react'
import { useStore } from '../store/AppStore'
import { Button, Chip, ConfirmDialog, Label, NumberField, Toast } from '../components/ui'
import { EQUIPMENT_LABEL } from '../data/exercises'
import { profileSchema } from '../lib/schemas'
import { generateProgram } from '../lib/program'
import type { Equipment, Goal, Level, Profile } from '../lib/types'

const GOALS: [Goal, string][] = [['muscle', 'Набор массы'], ['fat_loss', 'Снижение жира'], ['strength', 'Сила'], ['general', 'Общая форма']]
const LEVELS: [Level, string][] = [['beginner', 'Новичок'], ['intermediate', 'Средний'], ['advanced', 'Продвинутый']]
const LIMITS = [['shoulder', 'Плечо'], ['knee', 'Колено'], ['back', 'Спина'], ['wrist', 'Запястье'], ['elbow', 'Локоть']] as const
const toggle = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v])

export default function ProfilePage() {
  const s = useStore()
  const [f, setF] = useState<Profile>(s.data.profile!)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const [dlg, setDlg] = useState<'reset' | 'regen' | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((o) => ({ ...o, [k]: v }))
  const num = (k: 'age' | 'heightCm' | 'weightKg' | 'sessionMinutes' | 'experienceMonths') => (v: number | '') => set(k, v as number)

  const save = () => {
    const r = profileSchema.safeParse(f)
    if (!r.success) {
      const e: Record<string, string> = {}
      for (const i of r.error.issues) e[String(i.path[0])] ??= i.message
      setErrors(e)
      return false
    }
    setErrors({})
    s.saveProfile(r.data as Profile)
    setToast('Профиль сохранён')
    return true
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([s.exportData()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `gymforge-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-7">
      <h1 className="num text-5xl">Профиль</h1>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Возраст" value={f.age} onChange={num('age')} error={errors.age} suffix="лет" />
          <NumberField label="Рост" value={f.heightCm} onChange={num('heightCm')} error={errors.heightCm} suffix="см" />
          <NumberField label="Вес тела" value={f.weightKg} onChange={num('weightKg')} error={errors.weightKg} suffix="кг" />
          <NumberField label="Опыт" value={f.experienceMonths} onChange={num('experienceMonths')} error={errors.experienceMonths} suffix="мес." />
          <NumberField label="Длительность" value={f.sessionMinutes} onChange={num('sessionMinutes')} error={errors.sessionMinutes} suffix="мин" />
        </div>
        <div><Label>Уровень</Label><div className="flex flex-wrap gap-2">{LEVELS.map(([v, l]) => <Chip key={v} active={f.level === v} onClick={() => set('level', v)}>{l}</Chip>)}</div></div>
        <div><Label>Цель</Label><div className="flex flex-wrap gap-2">{GOALS.map(([v, l]) => <Chip key={v} active={f.goal === v} onClick={() => set('goal', v)}>{l}</Chip>)}</div></div>
        <div><Label>Дней в неделю</Label><div className="flex gap-2">{[2, 3, 4, 5, 6].map((n) => <Chip key={n} active={f.daysPerWeek === n} onClick={() => set('daysPerWeek', n)} className="flex-1">{n}</Chip>)}</div></div>
        <div>
          <Label>Оборудование</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).filter((e) => e !== 'cardio').map((e) => <Chip key={e} active={f.equipment.includes(e)} onClick={() => set('equipment', toggle(f.equipment, e))}>{EQUIPMENT_LABEL[e]}</Chip>)}
          </div>
          {errors.equipment && <div className="mt-1 text-xs font-semibold text-danger">{errors.equipment}</div>}
        </div>
        <div><Label>Ограничения</Label><div className="flex flex-wrap gap-2">{LIMITS.map(([v, l]) => <Chip key={v} active={f.limitations.includes(v)} onClick={() => set('limitations', toggle(f.limitations, v))}>{l}</Chip>)}</div></div>
        <div className="flex gap-3">
          <Button variant="primary" size="lg" className="flex-1" onClick={save}>Сохранить</Button>
          <Button size="lg" onClick={() => save() && setDlg('regen')}>Пересобрать программу</Button>
        </div>
      </section>

      <section className="space-y-3 rounded-[1.25rem] bg-surface p-4">
        <Label>Настройки</Label>
        <div className="flex items-center justify-between">
          <span>Отдых по умолчанию</span>
          <div className="flex gap-1">
            {[60, 90, 120, 180].map((n) => <Chip key={n} active={s.data.settings.restDefaultSec === n} onClick={() => s.updateSettings({ restDefaultSec: n })}>{n}с</Chip>)}
          </div>
        </div>
        <label className="flex items-center justify-between">
          <span>Вибрация в конце отдыха</span>
          <input type="checkbox" className="h-6 w-6 accent-[#C8FF36]" checked={s.data.settings.vibrate} onChange={(e) => s.updateSettings({ vibrate: e.target.checked })} />
        </label>
      </section>

      <section className="space-y-3 rounded-[1.25rem] bg-surface p-4">
        <Label>Данные</Label>
        <p className="text-sm text-mute">
          Демо-режим: данные хранятся только в этом браузере. Для облачного хранения и входа подключите Supabase — см. docs/SUPABASE.md. Сейчас делайте резервные копии вручную.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>Скачать копию</Button>
          <Button onClick={() => file.current?.click()}>Загрузить копию</Button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const t = await e.target.files?.[0]?.text()
              e.target.value = ''
              if (t === undefined) return
              if (s.importData(t)) setToast('Данные загружены')
              else setToast('Файл не подходит')
            }}
          />
          <Button variant="danger" onClick={() => setDlg('reset')}>Сбросить всё</Button>
        </div>
      </section>

      <ConfirmDialog open={dlg === 'reset'} title="Удалить все данные?" text="Профиль, программы и история будут удалены. Сначала лучше скачать копию." confirmLabel="Удалить" onCancel={() => setDlg(null)} onConfirm={() => { s.resetAll(); setDlg(null) }} />
      <ConfirmDialog
        open={dlg === 'regen'}
        title="Создать новую программу?"
        text="Текущая программа останется в списке, новая станет активной."
        confirmLabel="Создать"
        onCancel={() => setDlg(null)}
        onConfirm={() => { s.addProgram(generateProgram(f), true); setDlg(null); setToast('Новая программа создана') }}
      />
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  )
}
