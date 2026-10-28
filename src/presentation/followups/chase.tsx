import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, CalendarClock, Hourglass, Phone, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneMissed, PhoneOff, Voicemail } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ATTEMPT_RESULTS, attemptLabel, bestMinute, chaseOf, RESULT_ORDER, suggestRetry } from '@/domain/followups/chase'
import type { Chase } from '@/domain/followups/chase'
import { CHANNEL_LABELS } from '@/domain/followups/FollowUp'
import type { AttemptResult, FollowUp, FollowUpChannel } from '@/domain/followups/FollowUp'
import type { AttemptInput } from '@/domain/followups/FollowUpUseCases'
import { minutesOf } from '@/domain/shared/time'
import type { ISODate, Minutes } from '@/domain/shared/types'
import { friendlyDateTime } from '@/presentation/components/dates'
import { DateInput, TimeInput } from '@/presentation/components/form'
import { useAction, useEntities, useToday } from '@/presentation/data/hooks'

const RESULT_ICON: Record<AttemptResult, LucideIcon> = {
  no_answer: PhoneMissed,
  left_message: Voicemail,
  call_back: PhoneForwarded,
  they_will_call: PhoneIncoming,
  not_ready: Hourglass,
  reached: PhoneCall,
  unreachable: PhoneOff,
}

/** The first thing in a contact that looks like a phone number, so it can be dialled with a tap. */
const phoneOf = (contact?: string) => contact?.match(/\+?\d[\d\s().-]{6,}\d/)?.[0].replace(/[\s().-]/g, (c) => (c === '+' ? c : ''))

/** Where a chase stands, as a small badge: waiting on them, promised for a day, stuck. */
export function ChaseBadge({ chase, today }: { chase: Chase; today: ISODate }) {
  if (chase.kind === 'waiting') return <Pill icon={PhoneIncoming}>Waiting on them</Pill>
  if (chase.kind === 'promised')
    return (
      <Pill icon={Hourglass} tone={chase.promisedFor && chase.promisedFor < today ? 'danger' : undefined}>
        {chase.promisedFor ? `Promised for ${friendlyDateTime(chase.promisedFor, undefined, today)}` : 'Not done yet'}
      </Pill>
    )
  if (chase.kind === 'unreachable') return <Pill icon={PhoneOff} tone="danger">Needs a new number</Pill>
  if (chase.kind === 'stalled') return <Pill icon={AlertTriangle} tone="warning">{chase.misses} tries, no luck — try a message</Pill>
  return null
}

function Pill({ icon: Icon, tone, children }: { icon: LucideIcon; tone?: 'danger' | 'warning'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5', tone === 'danger' ? 'bg-destructive/10 text-destructive' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-muted')}>
      <Icon className="size-3" /> {children}
    </span>
  )
}

/** Every try so far, newest first: what happened, when, and what was said. */
export function AttemptHistory({ followUp, today }: { followUp: Pick<FollowUp, 'attempts' | 'channel'>; today: ISODate }) {
  const attempts = [...(followUp.attempts ?? [])].reverse()
  if (!attempts.length) return null
  return (
    <ol className="grid gap-1 border-l pl-3 text-[11px]">
      {attempts.map((a, i) => {
        const Icon = RESULT_ICON[a.result]
        return (
          <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
            <Icon className="size-3 translate-y-0.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">{attemptLabel(a.result, a.channel ?? followUp.channel)}</span>
            <span className="text-muted-foreground tabular-nums">{friendlyDateTime(a.date, a.minute, today)}</span>
            {a.promisedFor && <span className="text-muted-foreground">· promised for {friendlyDateTime(a.promisedFor, undefined, today)}</span>}
            {a.note && <span className="basis-full pl-[18px] text-muted-foreground">{a.note}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Log how a try went, in two taps: pick what happened, then confirm the next try, which is already
 * worked out from the history and what was said. Undo is one tap on the toast.
 */
export function LogCall({ followUp: f, label = 'Log call' }: { followUp: FollowUp; label?: string }) {
  const today = useToday()
  const { data: all } = useEntities('followUp')
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [note, setNote] = useState('')
  const [callBackAt, setCallBackAt] = useState<Minutes | undefined>(undefined)
  const [promisedFor, setPromisedFor] = useState<ISODate | undefined>(undefined)
  const [override, setOverride] = useState<{ date: ISODate; time?: Minutes } | null>(null)
  const [changing, setChanging] = useState(false)
  const [switchTo, setSwitchTo] = useState<FollowUpChannel | undefined>(undefined)
  const act = useAction<{ input: AttemptInput }, void>(async (s, userId, { input }) => {
    const logged = await s.followUps.logAttempt(userId, f.id, input)
    const next = logged.followUp.due
    const what = attemptLabel(input.result, f.channel)
    const message = input.result === 'reached' ? `${what} — closed` : next ? `${what} · next try ${friendlyDateTime(next.date, next.time, today).toLowerCase()}` : `${what} · nothing scheduled`
    toast.success(message, { action: { label: 'Undo', onClick: () => void s.followUps.restore(logged.before) } })
  })

  const suggestion = useMemo(
    () => (result ? suggestRetry(f.attempts ?? [], result, { date: today, minute: minutesOf(new Date()) }, { callBackAt, promisedFor, bestMinute: bestMinute(f.contact, all) }) : null),
    [result, f.attempts, f.contact, all, today, callBackAt, promisedFor],
  )
  const next = override ?? (suggestion ? { date: suggestion.date, time: suggestion.time } : null)
  const phone = phoneOf(f.contact)
  const chase = chaseOf(f)

  function reset() {
    setResult(null)
    setNote('')
    setCallBackAt(undefined)
    setPromisedFor(undefined)
    setOverride(null)
    setChanging(false)
    setSwitchTo(undefined)
  }

  async function save() {
    if (!result) return
    await act.run({ input: { result, note, callBackAt, promisedFor, next: override ?? undefined, switchTo } })
    setOpen(false)
    reset()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="xs" className="shrink-0" onClick={(e) => e.stopPropagation()} />}>
        <Phone /> {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-3" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">{f.contact ?? f.title}</span>
            {phone && f.channel === 'call' && (
              <a href={`tel:${phone}`} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-foreground px-2 py-1 font-medium text-background">
                <PhoneCall className="size-3" /> Call
              </a>
            )}
          </div>
          {chase.tries > 0 && <AttemptHistory followUp={{ attempts: (f.attempts ?? []).slice(-3), channel: f.channel }} today={today} />}
          <div role="radiogroup" aria-label="How did it go?" className="grid grid-cols-2 gap-1">
            {RESULT_ORDER.map((r) => {
              const Icon = RESULT_ICON[r]
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={result === r}
                  title={ATTEMPT_RESULTS[r].hint}
                  onClick={() => {
                    setResult(r)
                    setOverride(null)
                    setChanging(false)
                  }}
                  className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors', result === r ? 'border-foreground/30 bg-muted font-medium' : 'border-transparent hover:bg-muted/60', r === 'reached' && 'col-span-2')}
                >
                  <Icon className="size-4 shrink-0" /> {attemptLabel(r, f.channel)}
                </button>
              )
            })}
          </div>

          {result && (
            <div className="grid gap-2 rounded-lg bg-muted/50 p-2">
              {result === 'call_back' && (
                <label className="flex items-center justify-between gap-2 text-xs">
                  They said to call at
                  <span className="w-28">
                    <TimeInput value={callBackAt} onChange={setCallBackAt} />
                  </span>
                </label>
              )}
              {result === 'not_ready' && (
                <label className="flex items-center justify-between gap-2 text-xs">
                  They promised it for
                  <span className="w-36">
                    <DateInput value={promisedFor} onChange={setPromisedFor} aria-label="Promised for" />
                  </span>
                </label>
              )}
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={result === 'reached' ? 'How it ended (optional)' : 'What was said (optional)'} className="h-8 text-xs" />
              {result === 'reached' ? (
                <p className="text-[11px] text-muted-foreground">This closes the follow-up as reached. Need something more from them? Choose “Not done yet” instead.</p>
              ) : result === 'unreachable' ? (
                <p className="text-[11px] text-muted-foreground">Nothing will be scheduled. Put in a new number or contact when you have one.</p>
              ) : (
                next && (
                  <div className="grid gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <CalendarClock className="size-3.5" /> Next: {friendlyDateTime(next.date, next.time, today)}
                      </span>
                      <button type="button" onClick={() => setChanging((c) => !c)} className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                        {changing ? 'Use suggestion' : 'Change'}
                      </button>
                    </div>
                    {!changing && suggestion && !override && <span className="text-[11px] text-muted-foreground">{suggestion.reason}</span>}
                    {changing && (
                      <div className="grid grid-cols-2 gap-2">
                        <DateInput value={next.date} onChange={(d) => d && setOverride({ date: d, time: next.time })} aria-label="Next try date" />
                        <TimeInput value={next.time} onChange={(time) => setOverride({ date: next.date, time })} />
                      </div>
                    )}
                    {suggestion?.switchChannel && f.channel === 'call' && (
                      <button
                        type="button"
                        aria-pressed={switchTo === 'message'}
                        onClick={() => setSwitchTo(switchTo ? undefined : 'message')}
                        className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]', switchTo ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
                      >
                        <ArrowRightLeft className="size-3" /> {switchTo ? `Will go by ${CHANNEL_LABELS[switchTo].toLowerCase()}` : 'Switch to a message instead'}
                      </button>
                    )}
                  </div>
                )
              )}
              <Button size="sm" onClick={save} loading={act.pending} className="justify-self-end">
                {result === 'reached' ? 'Close as reached' : result === 'unreachable' ? 'Log it' : 'Log & schedule'}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
