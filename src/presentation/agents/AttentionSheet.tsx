import { useState } from 'react'
import { ArrowRight, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { AttentionEvent, AttentionItem, ExecutionItem } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { CARD_KINDS, cardKind } from './attentionCards'
import type { AttentionAction } from './useAttentionActions'
import { EmailBody } from './EmailPreview'
import { EventEditor } from './EventEditor'
import { parseMail } from './executions'
import { ago, } from './format'

const asExecutionItem = (i: AttentionItem): ExecutionItem => ({ id: i.itemId, title: i.title, excerpt: i.excerpt, label: i.label, confidence: i.confidence, reason: '', status: 'queued', at: i.at, decidedAt: null })

/**
 * A card opened. What it is and what to do about it on one side, the email itself on the other, and the decisions along the bottom,
 * where they are always in reach. Deciding moves on to the next card, so a queue can be cleared without going back to the list.
 */
export function AttentionSheet({ item, position, total, onClose, onStep, onDecide }: { item: AttentionItem | null; position: number; total: number; onClose: () => void; onStep: (by: 1 | -1) => void; onDecide: (item: AttentionItem, action: AttentionAction, event?: AttentionEvent) => void }) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetTitle className="sr-only">{item ? parseMail(item.excerpt).subject || item.title : 'Card'}</SheetTitle>
        <SheetDescription className="sr-only">What it says, what it asks of you, and the email itself.</SheetDescription>
        {item && <Open key={`${item.agentId}/${item.itemId}`} item={item} position={position} total={total} onStep={onStep} onDecide={onDecide} />}
      </SheetContent>
    </Sheet>
  )
}

function Open({ item, position, total, onStep, onDecide }: { item: AttentionItem; position: number; total: number; onStep: (by: 1 | -1) => void; onDecide: (item: AttentionItem, action: AttentionAction, event?: AttentionEvent) => void }) {
  const [tab, setTab] = useState<'decide' | 'email'>('decide')
  const [event, setEvent] = useState<AttentionEvent | null>(item.event)
  const kind = CARD_KINDS[cardKind(item)]
  const mail = parseMail(item.excerpt)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="grid gap-2 border-b px-5 pt-5 pr-14 pb-0">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('flex size-6 items-center justify-center rounded-lg', kind.tone)}>
            <kind.icon className="size-3.5" />
          </span>
          <span className="font-medium">{kind.label}</span>
          {item.priority === 'high' && <span className="rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">High priority</span>}
          <span className="text-muted-foreground">{item.agentName}{item.at ? ` · ${ago(item.at)}` : ''}</span>
        </div>
        <h2 className="font-display text-2xl leading-snug break-words">{mail.subject || item.title}</h2>
        <p className="truncate text-sm text-muted-foreground">From {mail.sender || 'an unknown sender'}</p>
        <div role="tablist" aria-label="View" className="-mb-px mt-1 flex gap-1">
          {([['decide', 'Decide'], ['email', 'The email']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('border-b-2 px-3 pb-2 text-sm font-medium transition-colors', tab === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'decide' ? (
          <div className="grid content-start gap-4 p-5">
            <section>
              <h3 className="mb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">What it is</h3>
              <p className="text-sm leading-relaxed break-words">{item.summary}</p>
              {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
            </section>
            {(item.action || item.due) && (
              <section className="grid gap-1.5 rounded-xl border bg-muted/30 p-3.5">
                <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">What it asks of you</h3>
                {item.action && (
                  <p className="flex items-start gap-1.5 text-sm">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                    {item.action}
                  </p>
                )}
                {item.due && (
                  <p className="flex items-center gap-1.5 text-sm text-warning">
                    <Clock className="size-3.5" /> Due {item.due}
                  </p>
                )}
              </section>
            )}
            {event && <EventEditor event={event} onChange={setEvent} />}
            {!event && item.status === 'event_proposed' && <p className="text-sm text-muted-foreground">The event was dropped. It stays here as an email to deal with.</p>}
            <button type="button" onClick={() => setTab('email')} className="w-fit text-sm font-medium underline-offset-2 hover:underline">
              Read the email
            </button>
          </div>
        ) : (
          <EmailBody item={asExecutionItem(item)} folder={item.folder} trashed={false} embedded />
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t bg-card/60 px-4 py-3">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Previous card" onClick={() => onStep(-1)} disabled={total < 2}>
            <ChevronLeft />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
            {position} of {total}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Next card" onClick={() => onStep(1)} disabled={total < 2}>
            <ChevronRight />
          </Button>
        </div>
        <span className="flex-1" />
        {item.event && event && (
          <Button variant="ghost" size="sm" onClick={() => onDecide(item, 'skip_event')}>
            Not an event
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDecide(item, 'dismiss')}>
          <X /> Not important
        </Button>
        <Button variant={event ? 'outline' : 'default'} size="sm" onClick={() => onDecide(item, 'done')}>
          <Check /> Done
        </Button>
        {event && (
          <Button size="sm" onClick={() => onDecide(item, 'approve_event', event)} disabled={!event.title.trim() || !event.date}>
            <CalendarPlus /> Add to calendar
          </Button>
        )}
      </footer>
    </div>
  )
}
