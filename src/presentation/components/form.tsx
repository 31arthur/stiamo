import { useId, useState } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Minutes } from '@/domain/shared/types'
import { spring } from '@/presentation/motion/presets'

export function Field({ label, hint, children, className, htmlFor }: { label: string; hint?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-input bg-transparent pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

const toClock = (m: Minutes | undefined) =>
  m === undefined ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function TimeInput({ value, onChange, id, required }: { value: Minutes | undefined; onChange: (m: Minutes | undefined) => void; id?: string; required?: boolean }) {
  return (
    <Input
      id={id}
      type="time"
      step={300}
      required={required}
      value={toClock(value)}
      onChange={(e) => {
        const [h, m] = e.target.value.split(':').map(Number)
        onChange(e.target.value ? h * 60 + m : undefined)
      }}
    />
  )
}

export function DateInput({ value, onChange, id, required, 'aria-label': ariaLabel }: { value: string | undefined; onChange: (d: string | undefined) => void; id?: string; required?: boolean; 'aria-label'?: string }) {
  return <Input id={id} aria-label={ariaLabel} type="date" required={required} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
}

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

/** Pill radio group with an animated selection. */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; label: string; size?: 'sm' | 'md' }) {
  const group = useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex w-fit flex-wrap gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
              selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {selected && <motion.span layoutId={group} transition={spring.snappy} className="absolute inset-0 rounded-md bg-background shadow-float" />}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Free-text tokens (attendees, steps). */
export function TokenInput({ values, onChange, placeholder, id }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {values.map((v) => (
        <span key={v} className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="text-muted-foreground hover:text-foreground">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={values.length ? '' : placeholder}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120]
