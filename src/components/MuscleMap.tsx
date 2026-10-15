import type { Muscle } from '../lib/types'
import { MUSCLE_LABEL } from '../data/exercises'

type Shape =
  | { t: 'e'; cx: number; cy: number; rx: number; ry: number }
  | { t: 'r'; x: number; y: number; w: number; h: number; rx: number }
  | { t: 'p'; d: string }

interface Region {
  muscle: Muscle
  shape: Shape
}

const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: 'e', cx, cy, rx, ry })
const mirror = (s: Extract<Shape, { t: 'e' }>): Shape => ({ ...s, cx: 100 - s.cx })
const pair = (muscle: Muscle, cx: number, cy: number, rx: number, ry: number): Region[] => [
  { muscle, shape: e(cx, cy, rx, ry) },
  { muscle, shape: mirror(e(cx, cy, rx, ry) as Extract<Shape, { t: 'e' }>) },
]

/** Силуэт: схематичный, одинаков для спереди и сзади. */
const BASE: Shape[] = [
  e(50, 13, 9, 10),
  { t: 'r', x: 45, y: 21, w: 10, h: 8, rx: 3 },
  { t: 'r', x: 33, y: 28, w: 34, h: 74, rx: 12 },
  e(24, 58, 6, 18),
  e(76, 58, 6, 18),
  e(20, 92, 5, 15),
  e(80, 92, 5, 15),
  e(41, 130, 9, 27),
  e(59, 130, 9, 27),
  e(40, 168, 6, 19),
  e(60, 168, 6, 19),
]

const FRONT: Region[] = [
  ...pair('chest', 42, 50, 9, 7),
  ...pair('shoulders', 30, 38, 7, 7),
  ...pair('biceps', 24, 58, 5, 13),
  { muscle: 'core', shape: { t: 'r', x: 42, y: 62, w: 16, h: 32, rx: 6 } },
  ...pair('quads', 41, 128, 7, 24),
  ...pair('calves', 40, 168, 5, 15),
]

const BACK: Region[] = [
  { muscle: 'back', shape: { t: 'p', d: 'M40 31 L60 31 L66 56 L58 76 L42 76 L34 56 Z' } },
  ...pair('shoulders', 30, 38, 7, 7),
  ...pair('triceps', 24, 58, 5, 13),
  ...pair('glutes', 43, 92, 8, 8),
  ...pair('hamstrings', 41, 125, 7, 22),
  ...pair('calves', 40, 167, 5, 15),
]

const BACK_ONLY: Muscle[] = ['back', 'hamstrings', 'glutes', 'triceps']

function renderShape(s: Shape, fill: string, opacity: number, key: string) {
  if (s.t === 'e') return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} opacity={opacity} />
  if (s.t === 'r') return <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={fill} opacity={opacity} />
  return <path key={key} d={s.d} fill={fill} opacity={opacity} />
}

function Figure({ regions, primary, secondary, dx }: { regions: Region[]; primary: Muscle[]; secondary: Muscle[]; dx: number }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      {BASE.map((s, i) => renderShape(s, 'var(--color-line)', 1, `b${i}`))}
      {regions.map((r, i) => {
        if (primary.includes(r.muscle)) return renderShape(r.shape, 'var(--color-lime)', 1, `p${i}`)
        if (secondary.includes(r.muscle)) return renderShape(r.shape, 'var(--color-lime)', 0.32, `s${i}`)
        return renderShape(r.shape, 'var(--color-surface-2)', 1, `n${i}`)
      })}
    </g>
  )
}

/**
 * Схема задействованных мышц. Это иллюстрация, а не демонстрация техники.
 * view="auto" показывает одну сторону тела (для превью), "both" — спереди и сзади.
 */
export default function MuscleMap({
  primary,
  secondary = [],
  view = 'auto',
  className = '',
}: {
  primary: Muscle[]
  secondary?: Muscle[]
  view?: 'auto' | 'front' | 'back' | 'both'
  className?: string
}) {
  const v = view === 'auto' ? (primary.some((m) => BACK_ONLY.includes(m)) ? 'back' : 'front') : view
  const label =
    `Схема мышц. Основные: ${primary.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}` +
    (secondary.length ? `. Вспомогательные: ${secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : '')
  const both = v === 'both'
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={both ? '0 0 200 190' : '0 0 100 190'}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      {(both || v === 'front') && <Figure regions={FRONT} primary={primary} secondary={secondary} dx={0} />}
      {(both || v === 'back') && (
        <Figure regions={BACK} primary={primary} secondary={secondary} dx={both ? 100 : 0} />
      )}
    </svg>
  )
}
