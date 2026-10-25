import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { spring } from '@/presentation/motion/presets'

export interface TabDef {
  id: string
  label: ReactNode
  content: ReactNode
}

/** Underlined tabs that scroll horizontally on small screens; content cross-fades. */
export function Tabs({ tabs, initial, className, listClassName }: { tabs: TabDef[]; initial?: string; className?: string; listClassName?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id)
  const group = useId()
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  return (
    <div className={cn('grid min-w-0 gap-4', className)}>
      <div role="tablist" className={cn('scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b px-1', listClassName)}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => setActive(t.id)}
            className={cn('relative shrink-0 px-2.5 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors', t.id === current.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
            {t.id === current.id && <motion.span layoutId={group} transition={spring.snappy} className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-foreground" />}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current.id} role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="min-w-0">
          {current.content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
