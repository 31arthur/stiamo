import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CheckCircle2, Minus, PlugZap, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Delivery, HealthCheck } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { ago } from '@/presentation/agents/format'
import { useDeliveries, useHealth } from '@/presentation/agents/useAgent'
import { useServices } from '@/presentation/app/services'
import { PageHeader, Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { Link } from '@/presentation/routing'

const GROUPS = ['AI', 'Phone', 'Mail', 'Google', 'Delivery', 'Server']
const ICON = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, off: Minus } as const
const TONE = { ok: 'text-success', warn: 'text-warning', error: 'text-destructive', off: 'text-muted-foreground/60' } as const

/** Every connection the app depends on, with whether it works, what to do if it doesn't, and a button to try it; and a log of what reached your phone. */
export function SetupPage() {
  const { data, isLoading, error, isFetching, refetch } = useHealth()
  const log = useRef<HTMLDivElement>(null)
  return (
    <>
      <PageHeader
        eyebrow="Tools"
        title="Setup and health"
        description="Everything the app relies on, and whether it is working. Fix what is red, try what you have set up, and see what reached your phone."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Spinner size="xs" tone="current" decorative /> : <RefreshCw />} Check again
          </Button>
        }
      />
      {isLoading ? (
        <Spinner label="Checking your setup" />
      ) : error || !data ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error instanceof Error ? error.message : 'The setup couldn’t be checked. The agent service needs to be deployed.'}
        </p>
      ) : (
        <div className="grid gap-5">
          <p className={cn('flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium', data.errors ? 'border-destructive/30 bg-destructive/5' : data.problems ? 'border-warning/40 bg-warning/10' : 'border-success/30 bg-success/10')}>
            {data.errors ? <XCircle className="size-4 text-destructive" /> : data.problems ? <AlertTriangle className="size-4 text-warning" /> : <CheckCircle2 className="size-4 text-success" />}
            {data.errors ? `${data.errors} thing${data.errors === 1 ? '' : 's'} won’t work until fixed` : data.problems ? `${data.problems} thing${data.problems === 1 ? '' : 's'} could be better` : 'Everything is working'}
            <span className="ml-auto text-xs font-normal text-muted-foreground">checked {ago(data.checkedAt)}</span>
          </p>
          {GROUPS.map((g) => {
            const items = data.items.filter((i) => i.group === g)
            if (items.length === 0) return null
            return (
              <Section key={g} title={g === 'AI' ? 'AI' : g === 'Delivery' ? 'Getting through' : g}>
                <ul className="grid divide-y">
                  {items.map((i) => (
                    <Check_ key={i.id} check={i} onLog={() => log.current?.scrollIntoView({ behavior: 'smooth' })} />
                  ))}
                </ul>
              </Section>
            )
          })}
          <div ref={log} id="delivery-log">
            <DeliveryLog />
          </div>
        </div>
      )}
    </>
  )
}

type Result = { ok: boolean; message: string }

function Check_({ check: c, onLog }: { check: HealthCheck; onLog: () => void }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const Icon = ICON[c.state]

  async function run() {
    if (!c.test) return
    setBusy(true)
    setResult(null)
    try {
      const t = c.test
      let message = 'Worked.'
      if (t.kind === 'channel') {
        await agent.sendTest(t.id)
        message = 'A message was sent. Check Telegram.'
      } else if (t.kind === 'secret') message = (await agent.testEnvironment(t.id)).message
      else if (t.kind === 'call') message = `Ringing ${(await agent.testCall()).user} now. Answer it on Telegram.`
      else if (t.kind === 'mailbox') message = (await agent.testMailbox(t.id)).message
      else if (t.kind === 'alert') {
        const r = await agent.sendSampleAlert()
        message = r.sent ? 'A sample alert was sent. Check Telegram.' : 'Nothing was sent: no Telegram chat is linked.'
      }
      setResult({ ok: true, message })
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'The test failed.' })
    } finally {
      setBusy(false)
      void client.invalidateQueries({ queryKey: ['agent', 'deliveries', userId] })
      void client.invalidateQueries({ queryKey: ['agent', 'health', userId] })
    }
  }

  return (
    <li className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[c.state])} aria-label={c.state} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{c.label}</p>
          <p className="text-xs text-muted-foreground">{c.detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {c.fix === 'log' ? (
            <Button variant="outline" size="xs" onClick={onLog}>
              See the log
            </Button>
          ) : c.fix ? (
            <Button variant="outline" size="xs" nativeButton={false} render={<Link to={c.fix === 'phone' ? '/assistant?phone=1' : c.fix} />}>
              {c.fix === 'phone' ? 'Set up' : 'Fix'}
            </Button>
          ) : null}
          {c.test && (
            <Button variant="ghost" size="xs" onClick={() => void run()} disabled={busy}>
              {busy ? <Spinner size="xs" tone="current" decorative /> : <PlugZap />} Test
            </Button>
          )}
        </div>
      </div>
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={cn('ml-7 flex items-start gap-1.5 text-xs', result.ok ? 'text-success' : 'text-destructive')}>
          {result.ok ? <Check className="mt-px size-3.5 shrink-0" /> : <XCircle className="mt-px size-3.5 shrink-0" />} {result.message}
        </p>
      )}
    </li>
  )
}

// --- what reached the phone ---------------------------------------------------------------------------------------

const KINDS: Record<string, string> = { alert: 'Alert', reminder: 'Reminder', plan: 'Plan', voice: 'Voice', call: 'Call', message: 'Message', test: 'Test' }

function DeliveryLog() {
  const [failedOnly, setFailedOnly] = useState(false)
  const { data, isLoading } = useDeliveries(failedOnly)
  return (
    <Section
      title="What reached your phone"
      description={data ? `${data.last24h.sent} delivered and ${data.last24h.failed} failed in the last day. Kept for a month.` : 'Alerts, reminders and calls, and whether each arrived.'}
      actions={
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} className="size-3.5 accent-[var(--foreground)]" /> Failures only
        </label>
      }
    >
      {isLoading ? (
        <Spinner label="Loading" />
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{failedOnly ? 'Nothing has failed.' : 'Nothing has been sent yet. Try “Send a sample alert” above.'}</p>
      ) : (
        <ul className="grid divide-y">
          {data.items.map((d) => (
            <Row key={d.id} d={d} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function Row({ d }: { d: Delivery }) {
  return (
    <li className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
      {d.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Delivered" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">{KINDS[d.kind] ?? d.kind}</span>
          <span className="truncate">{d.summary || 'Message'}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {d.target}
          {d.workspace && ` · ${d.workspace}`}
        </p>
        {!d.ok && d.error && <p className="mt-0.5 text-xs text-destructive">{d.error}</p>}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{ago(d.at)}</span>
    </li>
  )
}
