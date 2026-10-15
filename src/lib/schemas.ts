import { z } from 'zod'

const num = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label}: введите число` })
    .min(min, `${label}: не меньше ${min}`)
    .max(max, `${label}: не больше ${max}`)

export const profileSchema = z.object({
  age: num(14, 90, 'Возраст'),
  sex: z.enum(['male', 'female', 'other', '']),
  heightCm: num(120, 230, 'Рост'),
  weightKg: num(30, 250, 'Вес тела'),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  experienceMonths: num(0, 600, 'Опыт'),
  goal: z.enum(['muscle', 'fat_loss', 'strength', 'general']),
  daysPerWeek: num(2, 6, 'Дней в неделю'),
  sessionMinutes: num(30, 150, 'Длительность'),
  equipment: z.array(z.string()).min(1, 'Выберите хотя бы один тип оборудования'),
  preferred: z.array(z.string()),
  limitations: z.array(z.enum(['shoulder', 'knee', 'back', 'wrist', 'elbow'])),
})

export const setInputSchema = z.object({
  weight: num(0, 500, 'Вес'),
  reps: num(1, 100, 'Повторения'),
  rir: num(0, 5, 'RIR'),
})

export const testSetSchema = z.object({
  weight: num(0.5, 500, 'Вес'),
  reps: num(1, 30, 'Повторения'),
  rir: num(0, 5, 'RIR'),
})

export const bodyWeightSchema = num(30, 250, 'Вес тела')
