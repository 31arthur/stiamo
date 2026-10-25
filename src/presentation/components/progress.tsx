import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { spring } from '@/presentation/motion/presets'

/** Horizontal progress with an optional "where you should be" marker (time elapsed). */
export function ProgressBar({ value, marker, className, barClassName }: { value: number; marker?: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('relative h-1.5 w-full rounded-full bg-muted', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-foreground', barClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
        transition={spring.gentle}
      />
      {marker !== undefined && (
        <motion.span
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/50"
          initial={{ left: 0, opacity: 0 }}
          animate={{ left: `${Math.round(Math.min(1, Math.max(0, marker)) * 100)}%`, opacity: 1 }}
          transition={spring.gentle}
          title="Time elapsed"
        />
      )}
    </div>
  )
}

export function ProgressRing({ value, size = 48, stroke = 4, className, label, ringClassName }: { value: number; size?: number; stroke?: number; className?: string; label?: React.ReactNode; ringClassName?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-muted" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={cn('fill-none stroke-foreground', ringClassName)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={spring.gentle}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">{label ?? `${Math.round(value * 100)}%`}</span>
    </div>
  )
}
