import { motion } from 'motion/react'
import { CalendarDays, Check, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AttentionItem } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { CARD_KINDS, cardKind } from './attentionCards'
import { parseMail } from './executions'
import { ago } from './format'

const STRIPE: Record<string, string> = { high: 'bg-destructive', normal: 'bg-foreground/25', low: 'bg-transparent' }

/**
 * One thing waiting on you, as a card you can take in at a glance: what kind it is, how urgent, who from, what it says, and what it
 * asks of you. Click it to open it; the buttons on it are the two quick decisions that need no reading.
 */
export function AttentionCard({ item, selected, onOpen, onQuick }: { item: AttentionItem; selected: boolean; onOpen: () => void; onQuick: (a: 'done' | 'dismiss') => void }) {
  const kind = CARD_KINDS[cardKind(item)]
  const mail = parseMail(item.excerpt)
  const e = item.event
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="group relative min-w-0">
      <article className={cn('relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card/80 transition-all hover:-translate-y-px hover:border-foreground/25 hover:shadow-float', selected && 'border-foreground/40 shadow-float')}>
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', STRIPE[item.priority] ?? STRIPE.normal)} />
        <button type="button" onClick={onOpen} aria-label={`Open: ${mail.subject || item.title}`} className="flex flex-1 flex-col gap-2.5 p-4 pl-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex items-center gap-2 text-xs">
            <span className={cn('flex size-6 items-center justify-center rounded-lg', kind.tone)}>
              <kind.icon className="size-3.5" />
            </span>
            <span className="font-medium">{kind.label}</span>
            {item.priority === 'high' && <span className="rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">High</span>}
            <span className="ml-auto text-muted-foreground">{item.at ? ago(item.at) : ''}</span>
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 block font-semibold break-words">{mail.subject || item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{mail.sender || 'An unknown sender'}</span>
          </span>
          <span className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</span>
          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            {e && (
              <span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                <CalendarDays className="size-3" /> {e.date}
                {e.start ? ` · ${e.start}` : ''}
              </span>
            )}
            {item.due && (
              <span className="flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 font-medium text-warning">
                <Clock className="size-3" /> Due {item.due}
              </span>
            )}
            {item.action && <span className="min-w-0 truncate text-muted-foreground">{item.action}</span>}
          </span>
        </button>
        <div className="flex items-center gap-1 border-t px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate px-1.5 text-[11px] text-muted-foreground">{item.agentName}</span>
          <Button variant="ghost" size="xs" onClick={() => onQuick('dismiss')} aria-label={`Not important: ${mail.subject || item.title}`}>
            <X /> Not important
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onQuick('done')} aria-label={`Done: ${mail.subject || item.title}`}>
            <Check /> Done
          </Button>
        </div>
      </article>
    </motion.li>
  )
}
