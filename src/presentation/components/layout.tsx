import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { fadeUp, stagger } from '@/presentation/motion/presets'

export function PageHeader({ title, eyebrow, description, actions }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.header variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <motion.div variants={fadeUp} className="mb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </motion.div>
        )}
        <motion.h1 variants={fadeUp} className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          {title}
        </motion.h1>
        {description && (
          <motion.p variants={fadeUp} className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
          {actions}
        </motion.div>
      )}
    </motion.header>
  )
}

export function Section({ title, description, actions, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('rounded-2xl border bg-card/80 shadow-[0_1px_2px_oklch(0_0_0/4%)] backdrop-blur', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}
    >
      <div className="font-display text-2xl italic">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'default' | 'danger' | 'warning' | 'success' }) {
  return (
    <div className="rounded-xl border bg-card/70 px-3.5 py-2.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-2xl font-semibold tabular-nums',
          tone === 'danger' && 'text-destructive',
          tone === 'warning' && 'text-warning',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Small labelled metadata pair for detail headers. */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{children}</div>
    </div>
  )
}

/** A clickable region that may contain other buttons (a real <button> can't nest them). */
export function ClickableRow({ onActivate, className, children }: { onActivate: () => void; className?: string; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onActivate()
        }
      }}
      className={cn('cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)}
    >
      {children}
    </div>
  )
}
