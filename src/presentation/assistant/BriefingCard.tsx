import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { BellRing, BookOpen, CalendarClock, CalendarDays, CalendarRange, Check, ExternalLink, Gavel, ListChecks, Phone, Plus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { BriefingHit, BriefingItem, BriefingKind } from '@/domain/ai/AgentApi'
import type { ISODate, Minutes } from '@/domain/shared/types'
import { cn } from '@/lib/utils'
import { useEditor } from '@/presentation/app/create'
import { DateInput, TimeInput } from '@/presentation/components/form'
import { useToday } from '@/presentation/data/hooks'
import { moveOptions } from './moveOptions'
import { useBriefingActions } from './useBriefingActions'

const SECTION: Record<BriefingKind, { icon: LucideIcon; tone: string }> = {
  fixed: { icon: Gavel, tone: 'bg-ws-sb-soft text-ws-sb' },
  prepare: { icon: BookOpen, tone: 'bg-ws-media-soft text-ws-media' },
  calls: { icon: Phone, tone: 'bg-ws-fsa-soft text-ws-fsa' },
  work: { icon: ListChecks, tone: 'bg-success/12 text-success' },
  attention: { icon: BellRing, tone: 'bg-destructive/10 text-destructive' },
  later: { icon: CalendarRange, tone: 'bg-muted text-muted-foreground' },
}

const TYPE_ICON: Record<BriefingItem['type'], LucideIcon> = { hearing: Gavel, meeting: Users, task: ListChecks, followUp: Phone, calendar: CalendarDays, note: BookOpen }

/**
 * A day as the planner laid it out: sections of real hearings, meetings, tasks and calls. Each task and call can be finished or
 * moved right here, and anything can be added. The titles and times are read from your records, so they are always current.
 */
export function BriefingCard({ card, className }: { card: BriefingHit; className?: string }) {
  const editor = useEditor()
  const actions = useBriefingActions()
  const [moving, setMoving] = useState<BriefingItem | null>(null)
  const day = format(parseISO(card.date), 'EEEE d MMMM')

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('overflow-hidden rounded-2xl border bg-card/80', className)}>
      <header className="grid gap-1 border-b px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          <CalendarClock className="size-3.5" /> {day}
        </p>
        <h3 className="font-display text-xl leading-snug">{card.headline}</h3>
        {card.summary && <p className="text-sm text-muted-foreground">{card.summary}</p>}
      </header>

      <div className="grid divide-y">
        {card.sections.map((s) => {
          const style = SECTION[s.kind] ?? SECTION.work
          return (
            <section key={`${s.kind}-${s.title}`} aria-label={s.title} className="px-2 py-2.5 sm:px-3">
              <h4 className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground">
                <span className={cn('flex size-5 items-center justify-center rounded-md', style.tone)}>
                  <style.icon className="size-3" />
                </span>
                {s.title}
                <span className="tabular-nums">{s.items.length}</span>
              </h4>
              <ul>
                {s.items.map((item, i) => (
                  <ItemRow key={`${item.type}-${item.id ?? i}`} item={item} actions={actions} onMove={() => setMoving(item)} onOpen={() => item.id && item.type !== 'calendar' && item.type !== 'note' && editor.openRef({ kind: item.type, id: item.id })} />
                ))}
              </ul>
              {(s.kind === 'work' || s.kind === 'calls') && (
                <div className="px-2 pt-1">
                  <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => (s.kind === 'calls' ? editor.open({ kind: 'followUp', value: { due: { date: card.date } } }) : editor.open({ kind: 'task', value: { dueDate: card.date } }))}>
                    <Plus /> {s.kind === 'calls' ? 'Add a call' : 'Add a task'}
                  </Button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {card.free.length > 0 && (
        <footer className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          Free that day: {card.free.slice(0, 4).map((f) => `${f.from}–${f.to}`).join(' · ')}
          {card.free.length > 4 ? ' …' : ''}
        </footer>
      )}

      <MoveSheet item={moving} initial={card.date} onClose={() => setMoving(null)} onMove={(date, start) => (moving?.id && (moving.type === 'task' || moving.type === 'followUp' || moving.type === 'meeting') ? actions.move(moving.type, moving.id, date, start) : Promise.resolve())} />
    </motion.article>
  )
}

function ItemRow({ item, actions, onMove, onOpen }: { item: BriefingItem; actions: ReturnType<typeof useBriefingActions>; onMove: () => void; onOpen: () => void }) {
  if (item.type === 'note') return <li className="px-2 py-1.5 text-sm text-muted-foreground">{item.note}</li>

  const live = item.type === 'task' ? actions.tasks.find((t) => t.id === item.id) : item.type === 'followUp' ? actions.followUps.find((f) => f.id === item.id) : undefined
  const done = !!live && live.outcome.status !== 'open'
  const doable = item.type === 'task' || item.type === 'followUp'
  const movable = doable || item.type === 'meeting'
  const Icon = TYPE_ICON[item.type]
  const meta = [item.time, item.caseRef, item.type === 'task' && item.priority && item.priority !== 'normal' ? item.priority : null, item.type === 'followUp' && item.contact ? item.contact : null, item.place, item.tries ? `tried ${item.tries}×` : null, item.minutes ? `${item.minutes} min` : null].filter(Boolean)

  return (
    <li className="flex items-center gap-1 rounded-xl px-1 py-0.5 transition-colors hover:bg-muted/40">
      {doable && item.id ? (
        <button type="button" aria-label={done ? `Reopen ${item.title}` : `Mark ${item.title} done`} aria-pressed={done} onClick={() => void (done ? actions.reopen(item.type as 'task' | 'followUp', item.id!) : actions.complete(item.type as 'task' | 'followUp', item.id!))} className="flex size-11 shrink-0 items-center justify-center rounded-full">
          <span className={cn('flex size-6 items-center justify-center rounded-full border-2 transition-colors', done ? 'border-success bg-success text-white' : 'border-muted-foreground/40')}>{done && <Check className="size-3.5" strokeWidth={3} />}</span>
        </button>
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
      )}
      <button type="button" onClick={onOpen} disabled={item.type === 'calendar'} className="min-w-0 flex-1 py-1.5 text-left">
        <span className={cn('block text-[15px] leading-snug break-words', done && 'text-muted-foreground line-through')}>{item.title}</span>
        {meta.length > 0 && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {meta.map((m, i) => (
              <span key={i} className={cn(i === 0 && item.time && 'font-medium text-foreground/70 tabular-nums')}>
                {m}
              </span>
            ))}
          </span>
        )}
        {item.note && <span className="mt-0.5 block text-xs text-muted-foreground">{item.note}</span>}
      </button>
      {movable && !done && (
        <Button variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Move ${item.title}`} onClick={onMove}>
          <CalendarClock />
        </Button>
      )}
      {item.type === 'calendar' && item.link && (
        <Button variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Open ${item.title} in Google`} nativeButton={false} render={<a href={item.link} target="_blank" rel="noopener noreferrer" />}>
          <ExternalLink />
        </Button>
      )}
    </li>
  )
}

/** Move to another day, and a time if you want one. Comes up from the bottom, with big targets, so it is easy on a phone. */
function MoveSheet({ item, initial, onClose, onMove }: { item: BriefingItem | null; initial: ISODate; onClose: () => void; onMove: (date: ISODate, start?: Minutes) => Promise<unknown> }) {
  const today = useToday()
  const [date, setDate] = useState<ISODate | undefined>(initial)
  const [time, setTime] = useState<Minutes | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  async function go(d: ISODate, start?: Minutes) {
    setBusy(true)
    try {
      await onMove(d, start)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="px-5 pt-5 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">Move</SheetTitle>
          <SheetDescription className="line-clamp-2">{item?.title}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-5 pt-2 pb-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {moveOptions(today).map((o) => (
              <Button key={o.date} variant="outline" className="h-12 justify-center text-sm" disabled={busy} onClick={() => void go(o.date, time)}>
                {o.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Or choose a day and, if you like, a time</p>
            <div className="grid grid-cols-2 gap-2 [&_input]:h-12 [&_input]:text-base">
              <DateInput value={date} onChange={setDate} aria-label="Day" />
              <TimeInput value={time} onChange={setTime} />
            </div>
          </div>
          <Button size="lg" className="h-12" disabled={!date || busy} onClick={() => date && void go(date, time)}>
            Move{date ? ` to ${format(parseISO(date), 'EEE d MMM')}` : ''}
            {time !== undefined ? ` at ${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}` : ''}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
