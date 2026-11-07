import { PhoneCall, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { activityOf } from '@/domain/contacts/activity'
import type { Contact } from '@/domain/contacts/Contacts'
import { contactLine } from '@/domain/contacts/dial'
import { cn } from '@/lib/utils'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { CallLink } from '@/presentation/contacts/CallLink'
import { useEntities, useToday } from '@/presentation/data/hooks'

/** What the practice has done with one person: their calls and how each went, their open follow-ups and tasks, and a way to add the next one. */
export function ContactHistory({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const today = useToday()
  const { open } = useEditor()
  const { data: followUps } = useEntities('followUp')
  const { data: tasks } = useEntities('task')
  const a = contact ? activityOf(contact, followUps, tasks) : null
  const line = contact ? contactLine(contact.name, contact.phones[0]?.value ?? contact.emails[0]?.value) : ''

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,34rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">{contact?.name}</SheetTitle>
          <SheetDescription className="text-xs">{[contact?.title, contact?.organisation].filter(Boolean).join(' · ') || 'History with this person'}</SheetDescription>
        </SheetHeader>
        {contact && a && (
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Figure label="Tries" value={a.tries} />
              <Figure label="Reached" value={a.reached} />
              <Figure label="Last spoke" value={a.lastReached ? friendlyDate(a.lastReached, today) : '—'} small />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {contact.phones.slice(0, 2).map((p) => (
                <CallLink key={p.value} contact={p.value} className="px-2 py-1 text-xs" />
              ))}
              <Button size="sm" className="ml-auto" onClick={() => (onClose(), open({ kind: 'followUp', value: { contact: line, contactId: contact.id, workspace: contact.workspaces[0] } }))}>
                <Plus /> New follow-up
              </Button>
            </div>
            <section aria-label="Follow-ups" className="grid gap-1.5">
              <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Follow-ups</h3>
              {a.followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet. Add one with their number and it will show here.</p>
              ) : (
                <ul className="grid divide-y rounded-xl border">
                  {a.followUps.map((f) => {
                    const last = f.attempts?.at(-1)
                    return (
                      <li key={f.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                        <PhoneCall className={cn('mt-0.5 size-3.5 shrink-0', f.outcome.status === 'open' ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate font-medium', f.outcome.status !== 'open' && 'text-muted-foreground')}>{f.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {f.due ? friendlyDate(f.due.date, today) : 'Anytime'} · {f.outcome.status}
                            {last && ` · last try ${friendlyDate(last.date, today)}: ${last.result.replace('_', ' ')}`}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            {a.tasks.length > 0 && (
              <section aria-label="Tasks" className="grid gap-1.5">
                <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Tasks</h3>
                <ul className="grid divide-y rounded-xl border">
                  {a.tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className={cn('min-w-0 flex-1 truncate', t.outcome.status !== 'open' && 'text-muted-foreground line-through')}>{t.title}</span>
                      {t.dueDate && <span className="text-xs text-muted-foreground tabular-nums">{friendlyDate(t.dueDate, today)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Figure({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-xl border bg-card/70 px-2 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 font-semibold tabular-nums', small ? 'text-sm' : 'text-2xl')}>{value}</div>
    </div>
  )
}
