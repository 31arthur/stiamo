import { CallLink } from '@/presentation/contacts/CallLink'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { ArrowRight, BellRing, BookOpen, BookMarked, CalendarClock, CalendarDays, CalendarRange, Check, ExternalLink, Gavel, ListChecks, Phone, Plus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { BriefingHit, BriefingItem, BriefingKind } from '@/domain/ai/AgentApi'
import type { ISODate, Minutes } from '@/domain/shared/types'
import { cn } from '@/lib/utils'
import { useEditor } from '@/presentation/app/create'
import { DateInput, TimeInput } from '@/presentation/components/form'
import { useToday } from '@/presentation/data/hooks'
import { useIsCompact } from '@/presentation/layout/useMediaQuery'
import { moveOptions } from './moveOptions'
import { movedNote } from './liveItem'
import { useBriefingActions } from './useBriefingActions'

/** Each kind of section has its own colour: on its heading, and as the stripe down the side of its items. */
const SECTION: Record<BriefingKind, { icon: LucideIcon; tone: string; stripe: string }> = {
  fixed: { icon: Gavel, tone: 'bg-ws-sb-soft text-ws-sb', stripe: 'bg-ws-sb' },
  prepare: { icon: BookOpen, tone: 'bg-ws-media-soft text-ws-media', stripe: 'bg-ws-media' },
  calls: { icon: Phone, tone: 'bg-ws-fsa-soft text-ws-fsa', stripe: 'bg-ws-fsa' },
  work: { icon: ListChecks, tone: 'bg-success/12 text-success', stripe: 'bg-success' },
  // The story most worth your time, from the planner's push score.
  push: { icon: BookMarked, tone: 'bg-primary/10 text-primary', stripe: 'bg-primary' },
  attention: { icon: BellRing, tone: 'bg-destructive/10 text-destructive', stripe: 'bg-destructive' },
  later: { icon: CalendarRange, tone: 'bg-muted text-muted-foreground', stripe: 'bg-muted-foreground/40' },
}

const TYPE_ICON: Record<BriefingItem['type'], LucideIcon> = { hearing: Gavel, meeting: Users, task: ListChecks, followUp: Phone, calendar: CalendarDays, note: BookOpen }

type Actions = ReturnType<typeof useBriefingActions>

/**
 * A day as the planner laid it out: sections of real hearings, meetings, tasks and calls. Each task and call can be finished or
 * moved right here, and anything can be added. The titles and times are read from your records, so they are always current.
 */
export function BriefingCard({ card, className }: { card: BriefingHit; className?: string }) {
  const editor = useEditor()
  const actions = useBriefingActions()
  const [moving, setMoving] = useState<BriefingItem | null>(null)
  const day = format(parseISO(card.date), 'EEEE d MMMM')
  const movable = moving && moving.id && (moving.type === 'task' || moving.type === 'followUp' || moving.type === 'meeting') ? { type: moving.type, id: moving.id } : null

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('overflow-hidden rounded-2xl border bg-card shadow-float', className)}>
      <header className="grid gap-1.5 border-b bg-muted/30 px-4 py-4 sm:px-5">
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium shadow-[0_0_0_1px_var(--border)]">
          <CalendarClock className="size-3.5 text-primary" /> {day}
        </p>
        <h3 className="font-display text-2xl leading-snug tracking-tight sm:text-[1.7rem]">{card.headline}</h3>
        {card.summary && <p className="max-w-prose text-sm text-muted-foreground">{card.summary}</p>}
      </header>

      <div className="grid gap-5 p-3 sm:p-4">
        {card.sections.map((s) => {
          const style = SECTION[s.kind] ?? SECTION.work
          const rows = s.items.filter((i) => i.type !== 'note')
          const notes = s.items.filter((i) => i.type === 'note')
          return (
            <section key={`${s.kind}-${s.title}`} aria-label={s.title} className="grid gap-2">
              <h4 className="flex items-center gap-2 px-1 text-sm font-semibold">
                <span className={cn('flex size-6 items-center justify-center rounded-lg', style.tone)}>
                  <style.icon className="size-3.5" />
                </span>
                {s.title}
                <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">{s.items.length}</span>
              </h4>
              {rows.length > 0 && (
                <ul className={cn('grid gap-2', rows.length > 1 && 'md:grid-cols-2')}>
                  {rows.map((item, i) => (
                    <ItemTile key={`${item.type}-${item.id ?? i}`} item={item} day={card.date} stripe={style.stripe} actions={actions} onMove={() => setMoving(item)} onOpen={() => item.id && item.type !== 'calendar' && editor.openRef({ kind: item.type as 'task', id: item.id })} />
                  ))}
                </ul>
              )}
              {notes.map((n, i) => (
                <p key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {n.note}
                </p>
              ))}
              {(s.kind === 'work' || s.kind === 'calls') && (
                <Button variant="ghost" size="sm" className="h-10 w-fit text-muted-foreground" onClick={() => (s.kind === 'calls' ? editor.open({ kind: 'followUp', value: { due: { date: card.date } } }) : editor.open({ kind: 'task', value: { dueDate: card.date } }))}>
                  <Plus /> {s.kind === 'calls' ? 'Add a call' : 'Add a task'}
                </Button>
              )}
            </section>
          )
        })}
      </div>

      {card.free.length > 0 && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <span className="font-medium text-foreground/70">Free that day</span>
          {card.free.slice(0, 4).map((f) => (
            <span key={f.from} className="rounded-md bg-background px-1.5 py-0.5 tabular-nums shadow-[0_0_0_1px_var(--border)]">
              {f.from}–{f.to}
            </span>
          ))}
          {card.free.length > 4 && <span>+{card.free.length - 4} more</span>}
        </footer>
      )}

      <MoveDialog item={moving} initial={card.date} onClose={() => setMoving(null)} onMove={(date, start) => (movable ? actions.move(movable.type, movable.id, date, start) : Promise.resolve())} />
    </motion.article>
  )
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-4 font-medium text-muted-foreground', className)}>{children}</span>
}

function ItemTile({ item, day, stripe, actions, onMove, onOpen }: { item: BriefingItem; day: ISODate; stripe: string; actions: Actions; onMove: () => void; onOpen: () => void }) {
  const live = item.type === 'task' ? actions.tasks.find((t) => t.id === item.id) : item.type === 'followUp' ? actions.followUps.find((f) => f.id === item.id) : item.type === 'meeting' ? actions.meetings.find((m) => m.id === item.id) : undefined
  const where = movedNote(item, live, day)
  const done = !!live && live.outcome.status !== 'open'
  const title = live?.title ?? item.title
  const doable = item.type === 'task' || item.type === 'followUp'
  const movable = doable || item.type === 'meeting'
  const Icon = TYPE_ICON[item.type]
  const urgent = item.priority === 'urgent' || item.priority === 'high'

  return (
    <li className={cn('flex overflow-hidden rounded-xl border bg-background transition-all hover:border-foreground/25 hover:shadow-float', done && 'opacity-60', where.changed && !done && 'border-primary/40 bg-primary/[0.03]')}>
      <span aria-hidden className={cn('w-1 shrink-0', stripe)} />
      <div className="flex min-w-0 flex-1 items-start gap-1 p-1.5">
        {doable && item.id ? (
          <button type="button" aria-label={done ? `Reopen ${title}` : `Mark ${title} done`} aria-pressed={done} onClick={() => void (done ? actions.reopen(item.type as 'task' | 'followUp', item.id!) : actions.complete(item.type as 'task' | 'followUp', item.id!))} className="flex size-10 shrink-0 items-center justify-center rounded-full">
            <span className={cn('flex size-6 items-center justify-center rounded-full border-2 transition-colors', done ? 'border-success bg-success text-white' : 'border-muted-foreground/40 hover:border-foreground/60')}>{done && <Check className="size-3.5" strokeWidth={3} />}</span>
          </button>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center text-muted-foreground">
            <Icon className="size-4.5" />
          </span>
        )}

        <button type="button" onClick={onOpen} disabled={item.type === 'calendar'} className="grid min-w-0 flex-1 gap-1.5 py-1.5 text-left">
          <span className={cn('text-[15px] leading-snug font-medium break-words', done && 'text-muted-foreground line-through')}>{title}</span>
          <span className="flex flex-wrap items-center gap-1">
            {where.movedTo ? (
              <Pill className="bg-primary text-primary-foreground tabular-nums">
                <ArrowRight className="mr-1 size-3" /> Moved to {where.movedTo}
              </Pill>
            ) : (
              where.time && <Pill className={cn('tabular-nums', where.changed ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>{where.changed && 'Now '}{where.time}</Pill>
            )}
            {item.caseRef && <Pill className="bg-ws-sb-soft font-mono text-ws-sb">{item.caseRef}</Pill>}
            {urgent && <Pill className="bg-destructive/10 text-destructive capitalize">{item.priority}</Pill>}
            {item.type === 'followUp' && item.contact && <CallLink contact={item.contact} channel={(['call', 'message', 'email', 'visit'] as const).find((c) => c === item.channel) ?? 'call'} />}
            {item.place && <Pill>{item.place}</Pill>}
            {!!item.tries && <Pill className="bg-warning/15 text-warning">Tried {item.tries}×</Pill>}
            {!!item.minutes && <Pill>{item.minutes} min</Pill>}
          </span>
          {item.note && <span className="text-[13px] leading-snug text-muted-foreground">{item.note}</span>}
        </button>

        {movable && !done && (
          <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 px-2.5 text-muted-foreground max-sm:size-9 max-sm:px-0" aria-label={`Move ${title}`} onClick={onMove}>
            <CalendarClock />
            <span className="max-sm:sr-only">{where.changed ? 'Move again' : 'Move'}</span>
          </Button>
        )}
        {item.type === 'calendar' && item.link && (
          <Button variant="outline" size="icon" className="size-9 shrink-0 text-muted-foreground" aria-label={`Open ${item.title} in Google`} nativeButton={false} render={<a href={item.link} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink />
          </Button>
        )}
      </div>
    </li>
  )
}

/** Move to another day, and a time if you want one. A centred dialog on a large screen, a sheet from the bottom on a phone. */
function MoveDialog({ item, initial, onClose, onMove }: { item: BriefingItem | null; initial: ISODate; onClose: () => void; onMove: (date: ISODate, start?: Minutes) => Promise<unknown> }) {
  const compact = useIsCompact()
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

  const body = (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-2">
        {moveOptions(today).map((o) => (
          <Button key={o.date} variant="outline" className="h-auto flex-col items-start gap-0 px-3.5 py-2.5 text-left" disabled={busy} onClick={() => void go(o.date, time)}>
            <span className="text-sm font-semibold">{o.label}</span>
            <span className="text-xs font-normal text-muted-foreground">{format(parseISO(o.date), 'EEE d MMM')}</span>
          </Button>
        ))}
      </div>
      <fieldset className="grid gap-2 rounded-xl border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Another day or time</legend>
        <div className="grid gap-2 sm:grid-cols-2 [&_input]:h-11 [&_input]:text-base">
          <DateInput value={date} onChange={setDate} aria-label="Day" />
          <TimeInput value={time} onChange={setTime} />
        </div>
        <Button className="mt-1 h-11" disabled={!date || busy} onClick={() => date && void go(date, time)}>
          Move{date ? ` to ${format(parseISO(date), 'EEE d MMM')}` : ''}
          {time !== undefined ? ` at ${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}` : ''}
        </Button>
      </fieldset>
    </div>
  )

  if (compact) {
    return (
      <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="px-5 pt-5 pr-12">
            <SheetTitle className="font-display text-2xl font-normal">Move</SheetTitle>
            <SheetDescription className="line-clamp-2">{item?.title}</SheetDescription>
          </SheetHeader>
          <div className="px-5 pt-2 pb-5">{body}</div>
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Move</DialogTitle>
          <DialogDescription className="line-clamp-2">{item?.title}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
