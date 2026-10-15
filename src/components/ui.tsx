import { useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Minus, Plus, X } from 'lucide-react'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
type Size = 'md' | 'lg' | 'sm'

export function Button({
  variant = 'outline',
  size = 'md',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const v: Record<Variant, string> = {
    primary: 'bg-lime text-bg font-extrabold hover:brightness-95 active:scale-[0.98]',
    outline: 'border border-line text-ink hover:bg-surface-2 active:scale-[0.98]',
    ghost: 'text-mute hover:text-ink hover:bg-surface',
    danger: 'border border-danger/60 text-danger hover:bg-danger/10',
  }
  const s: Record<Size, string> = {
    sm: 'h-9 px-3 text-sm rounded-xl',
    md: 'h-11 px-4 text-[15px] rounded-2xl',
    lg: 'h-16 px-6 text-lg rounded-2xl',
  }
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 font-bold transition disabled:opacity-40 ${v[variant]} ${s[size]} ${className}`}
    />
  )
}

export function Card({
  className = '',
  children,
  ...p
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={`rounded-[1.25rem] bg-surface p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Chip({
  active,
  children,
  onClick,
  className = '',
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${
        active ? 'bg-lime text-bg' : 'bg-surface text-mute hover:text-ink'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-mute">{children}</div>
}

export function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: ReactNode
  unit?: string
  accent?: 'lime' | 'ember'
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-mute">{label}</div>
      <div
        className={`num text-4xl leading-none ${accent === 'lime' ? 'text-lime' : accent === 'ember' ? 'text-ember' : 'text-ink'}`}
      >
        {value}
        {unit && <span className="ml-1 text-lg text-mute">{unit}</span>}
      </div>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-line p-6 text-center">
      <div className="text-lg font-extrabold">{title}</div>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-mute">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="rise max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] bg-bg p-5 outline-none sm:rounded-[1.75rem]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button aria-label="Закрыть" onClick={onClose} className="rounded-full bg-surface p-2 text-mute hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Подтвердить',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  text: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="mb-5 text-mute">{text}</p>
      <div className="flex gap-3">
        <Button className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

/** Числовой ввод с текстовым вводом и кнопками ± (крупные цели нажатия). */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 1000,
  unit,
  label,
  big,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  label: string
  big?: boolean
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const btn = big ? 'h-16 w-16 rounded-2xl' : 'h-11 w-11 rounded-xl'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label}: меньше`}
        onClick={() => onChange(clamp(value - step))}
        className={`${btn} grid shrink-0 place-items-center bg-lime text-bg active:scale-95`}
      >
        <Minus size={big ? 28 : 20} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <input
          inputMode="decimal"
          aria-label={label}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value.replace(',', '.'))
            if (e.target.value !== '' && Number.isFinite(n)) onChange(clamp(n))
          }}
          onBlur={() => setText(String(value))}
          className={`num w-full bg-transparent text-center outline-none ${big ? 'text-6xl' : 'text-3xl'}`}
        />
        {unit && <div className="-mt-1 text-xs font-semibold text-mute">{unit}</div>}
      </div>
      <button
        type="button"
        aria-label={`${label}: больше`}
        onClick={() => onChange(clamp(value + step))}
        className={`${btn} grid shrink-0 place-items-center bg-lime text-bg active:scale-95`}
      >
        <Plus size={big ? 28 : 20} strokeWidth={3} />
      </button>
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  suffix,
  placeholder,
}: {
  label: string
  value: number | ''
  onChange: (v: number | '') => void
  error?: string
  suffix?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div
        className={`flex h-12 items-center rounded-2xl bg-surface px-4 ${error ? 'ring-1 ring-danger' : 'focus-within:ring-2 focus-within:ring-lime'}`}
      >
        <input
          type="number"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full bg-transparent font-semibold outline-none"
        />
        {suffix && <span className="text-sm text-mute">{suffix}</span>}
      </div>
      {error && <div className="mt-1 text-xs font-semibold text-danger">{error}</div>}
    </label>
  )
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [onDone, text])
  return (
    <div role="status" className="rise fixed bottom-28 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-bg shadow-xl lg:bottom-8">
      {text}
    </div>
  )
}
