import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, Eye, KeyRound, Play, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { PromptPreview, SafeSenders, WorkflowConfig, WorkflowRun } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { DateInput, Field, TokenInput } from '@/presentation/components/form'
import { Switch } from '@/presentation/components/Switch'
import { Section } from '@/presentation/components/layout'
import { useMailAccounts, useMailAvailable } from '@/presentation/mail/useMail'
import { toast } from '@/presentation/notifications/toast'
import { ProvidersDialog } from './ModelPicker'
import { DEFAULT_GUIDE, GUIDE_FIELDS, composeGuide, isGuide, withGuide, withPreset } from './mailGuide'
import type { MailGuide } from './mailGuide'
import { useAgentSettings } from './useAgent'
import { WORKSPACES, WORKSPACE_IDS } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { Link } from '@/presentation/routing'
import { TestResults } from './TestResults'
import { TABLE_LABELS } from './workflowTemplates'

export interface WorkflowDraft {
  name: string
  description: string
  config: WorkflowConfig
}

const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const DAYS = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
]

/** Label names are lower case words joined by underscores, so they can be keys and folder names later. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '').slice(0, 40)

/** Everything a person decides about an agent that sorts a source: what it reads, how it is told to judge, and the labels. */
export function WorkflowBuilder({ initial, saveLabel, saving, onSave, extra, onDelete }: { initial: WorkflowDraft; saveLabel: string; saving: boolean; onSave: (d: WorkflowDraft) => void; extra?: ReactNode; onDelete?: () => void }) {
  const { agent } = useServices()
  const mailAvailable = useMailAvailable()
  const { accounts } = useMailAccounts()
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [cfg, setCfg] = useState<WorkflowConfig>(initial.config)
  const [sample, setSample] = useState('')
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const set = (p: Partial<WorkflowConfig>) => setCfg((c) => ({ ...c, ...p }))
  const setFilters = (p: Partial<WorkflowConfig['filters']>) => setCfg((c) => ({ ...c, filters: { ...c.filters, ...p } }))
  const setLabel = (i: number, p: Partial<WorkflowConfig['labels'][number]>) => setCfg((c) => ({ ...c, labels: c.labels.map((l, j) => (j === i ? { ...l, ...p } : l)) }))
  const manual = cfg.source.kind === 'manual'
  const mail = cfg.source.kind === 'mail'
  const rules = cfg.rules ?? { protectedDomains: [], protectedPhrases: [], protectCorrespondents: true, protectedAddresses: [] }
  const action = cfg.action ?? { trashLabel: null, auto: false }
  const setRules = (p: Partial<typeof rules>) => set({ rules: { ...rules, ...p } })
  const setAction = (p: Partial<typeof action>) => set({ action: { ...action, ...p } })
  const mailboxes = cfg.source.accountIds ?? []
  const needsMailbox = mail && mailboxes.length === 0
  const dirty = JSON.stringify({ name, description, cfg }) !== JSON.stringify({ name: initial.name, description: initial.description, cfg: initial.config })

  async function test() {
    setTesting(true)
    setError(null)
    try {
      setRun(await agent.testDraft(cfg, manual ? sample : undefined))
    } catch (e) {
      setRun(null)
      setError(e instanceof Error ? e.message : 'The test failed.')
      toast.error(`${name.trim() || 'The agent'}: the test run failed`, { description: e instanceof Error ? e.message : undefined })
    } finally {
      setTesting(false)
    }
  }

  const guide = isGuide(cfg.guide) ? cfg.guide : null
  // Until the person edits a section, picking a mailbox fills them in with the example for its workspace.
  const pristine = !!guide && JSON.stringify(initial.config.guide) === JSON.stringify(DEFAULT_GUIDE)
  const touched = useRef(!pristine)
  const composed = guide ? composeGuide(guide, cfg.labels) : { prompt: '', labels: [] }
  const n = (i: number, title: string) => (mail ? `${i} · ${title}` : title)
  const setGuide = (g: MailGuide) => {
    touched.current = true
    setCfg((c) => withGuide(c, g))
  }
  const applyExample = (ws: WorkspaceId) => {
    if (touched.current && !window.confirm(`Replace what you wrote with the example for ${WORKSPACES[ws].name}?`)) return
    touched.current = true
    setCfg((c) => withPreset(c, ws))
  }
  const pickMailboxes = (ids: string[]) =>
    setCfg((c) => {
      const next = { ...c, source: { ...c.source, accountIds: ids } }
      const ws = accounts.find((a) => a.id === ids[0])?.workspace
      return !touched.current && ws && isGuide(c.guide) ? withPreset(next, ws) : next
    })

  const rawSection = (
    <Section title="How it decides" description="Say what the sorting is for, then define the labels. The model reads the descriptions to choose, so make them concrete.">
          <div className="grid gap-4">
            <textarea value={cfg.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={4} placeholder="You sort my… Decide whether each item…" aria-label="What the sorting is for" className={AREA} maxLength={4000} />

            <ul className="grid gap-2" aria-label="Labels">
              {cfg.labels.map((l, i) => (
                <li key={i} className="grid gap-2 rounded-xl border p-2.5 sm:grid-cols-[9rem_1fr_auto]">
                  <Input value={l.name} onChange={(e) => setLabel(i, { name: slug(e.target.value) })} placeholder="label_name" aria-label="Label name" className="h-8 font-mono text-xs" />
                  <Input value={l.description} onChange={(e) => setLabel(i, { description: e.target.value })} placeholder="What makes an item this label" aria-label="What the label means" className="h-8 text-sm" maxLength={300} />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={l.threshold == null ? '' : Math.round(l.threshold * 100)}
                      onChange={(e) => setLabel(i, { threshold: e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                      placeholder={`${Math.round(cfg.defaultThreshold * 100)}`}
                      aria-label="Confidence needed, in percent"
                      title="Confidence needed, in percent. Under it, the item goes to review."
                      className="h-8 w-16 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    {cfg.labels.length > 2 && (
                      <Button variant="ghost" size="icon-xs" aria-label="Remove label" onClick={() => set({ labels: cfg.labels.filter((_, j) => j !== i) })}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {cfg.labels.length < 12 && (
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => set({ labels: [...cfg.labels, { name: '', description: '' }] })}>
                <Plus /> Add a label
              </Button>
            )}

            <label className="grid gap-1 border-t pt-4 text-xs text-muted-foreground sm:max-w-sm">
              Unsure below {Math.round(cfg.defaultThreshold * 100)}%: send to review
              <input type="range" min={0} max={100} step={5} value={Math.round(cfg.defaultThreshold * 100)} onChange={(e) => set({ defaultThreshold: Number(e.target.value) / 100 })} className="accent-[var(--foreground)]" aria-label="Default confidence needed" />
            </label>
          </div>
    </Section>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="grid content-start gap-4">
        {mail && (
          <details className="rounded-2xl border bg-card/80 px-4 py-3" open={pristine}>
            <summary className="cursor-pointer text-sm font-semibold">How to set this up</summary>
            <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
              <li>Name it, and choose the workspace at the bottom. It then appears under TTF in that workspace.</li>
              <li>Choose the mailbox, and which emails: the whole inbox, the last few days, or between two dates.</li>
              <li>Describe the inbox in the five boxes. Picking a mailbox fills them with an example for its workspace: change anything.</li>
              <li>Keep safe: people you have written to, and any domains, phrases or addresses that must never be touched.</li>
              <li>Choose what happens to spam. Leave “by itself” off at first, so you approve in Review.</li>
              <li>Press Test run, read the reasons, fix the boxes if it judges wrongly, then Create agent and Run it from its page.</li>
            </ol>
          </details>
        )}

        <Section title={n(1, mail ? 'Name it' : 'About')}>
          <div className="grid gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Task triage" aria-label="Name" maxLength={100} />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it is for, in a line" aria-label="Description" maxLength={300} />
          </div>
        </Section>

        <Section title={n(2, 'What it reads')} description="The items it goes through each time. Filters are applied in code first, so you only pay for the items that matter.">
          <div className="grid gap-4">
            <div role="radiogroup" aria-label="Source" className="grid gap-2 sm:grid-cols-2">
              {[
                { kind: 'manual' as const, title: 'Text you paste', hint: 'To try an idea. Separate items with a line of ---.' },
                { kind: 'table' as const, title: 'A Stiamo collection', hint: 'Your cases, tasks, follow-ups, meetings, clients or projects.' },
                ...(mailAvailable || mail ? [{ kind: 'mail' as const, title: 'A mailbox', hint: 'A mailbox you connected in Mail. It reads the inbox, newest first.' }] : []),
              ].map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  role="radio"
                  aria-checked={cfg.source.kind === o.kind}
                  onClick={() => set({ source: { kind: o.kind, table: o.kind === 'table' ? (cfg.source.table ?? 'tasks') : null, accountIds: o.kind === 'mail' ? (mailboxes.length ? mailboxes : accounts.slice(0, 1).map((a) => a.id)) : undefined, folder: 'INBOX' }, filters: { ...cfg.filters, newOnly: o.kind !== 'manual' } })}
                  className={cn('rounded-xl border p-3 text-left transition-colors', cfg.source.kind === o.kind ? 'border-foreground/40 bg-background shadow-float' : 'hover:border-foreground/20')}
                >
                  <span className="block text-sm font-medium">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">News feeds are coming: they will be sources here too.</p>
            </div>

            {!manual && (
              <div className="grid gap-3 sm:grid-cols-2">
                {mail ? (
                  <fieldset className="grid gap-1.5 sm:col-span-2">
                    <legend className="mb-1 text-xs text-muted-foreground">Mailboxes it reads (one or several)</legend>
                    {accounts.length === 0 ? (
                      <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                        No mailbox is connected yet. <Link to="/mail" className="underline underline-offset-2">Connect one in Mail</Link>, then come back.
                      </p>
                    ) : (
                      accounts.map((a) => {
                        const on = mailboxes.includes(a.id)
                        return (
                          <label key={a.id} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors', on ? 'border-foreground/40 bg-background' : 'hover:border-foreground/20')}>
                            <input type="checkbox" checked={on} onChange={() => pickMailboxes(on ? mailboxes.filter((id) => id !== a.id) : [...mailboxes, a.id])} className="size-4 accent-[var(--foreground)]" />
                            <span className="min-w-0 flex-1 truncate">
                              {a.label} <span className="text-muted-foreground">· {a.address}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{WORKSPACES[a.workspace].short}</span>
                          </label>
                        )
                      })
                    )}
                  </fieldset>
                ) : (
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Collection
                    <select value={cfg.source.table ?? 'tasks'} onChange={(e) => set({ source: { kind: 'table', table: e.target.value } })} className={SELECT}>
                      {Object.entries(TABLE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {mail ? (
                  <WhichMail filters={cfg.filters} setFilters={setFilters} />
                ) : (
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Created or changed
                    <select value={cfg.filters.sinceDays ? String(cfg.filters.sinceDays) : ''} onChange={(e) => setFilters({ sinceDays: e.target.value ? Number(e.target.value) : null })} className={SELECT}>
                      {DAYS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Only if it contains
                  <Input value={cfg.filters.contains ?? ''} onChange={(e) => setFilters({ contains: e.target.value || null })} placeholder="a word (optional)" maxLength={100} className="h-8" />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  {mail ? 'Emails per run' : 'At most'}
                  {mail ? (
                    <select value={cfg.filters.limit} onChange={(e) => setFilters({ limit: Number(e.target.value) })} className={SELECT}>
                      {[25, 50, 100, 200, 500].map((n) => (
                        <option key={n} value={n}>
                          {n} at a time
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input type="number" min={1} max={500} value={cfg.filters.limit} onChange={(e) => setFilters({ limit: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} className="h-8" />
                  )}
                  {mail && <span>A run does this many; run again, or use “Run through the whole inbox”, to carry on with the rest.</span>}
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={cfg.filters.newOnly} onChange={(e) => setFilters({ newOnly: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
                  Skip items it has already decided
                </label>
              </div>
            )}
          </div>
        </Section>

        {!(mail && guide) && rawSection}

        {mail && guide && (
          <Section title={n(3, 'Describe your inbox')} description="Tell the agent what this inbox is for. These five boxes are the prompt: change any of them and the instructions it reads update.">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Start from the example for
                {WORKSPACE_IDS.map((ws) => (
                  <button key={ws} type="button" onClick={() => applyExample(ws)} className="rounded-full border px-2.5 py-1 text-foreground transition-colors hover:bg-muted">
                    {WORKSPACES[ws].short}
                  </button>
                ))}
              </div>
              {GUIDE_FIELDS.map((f) => (
                <label key={f.key} className="grid gap-1">
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.hint}</span>
                  <textarea value={guide[f.key]} onChange={(e) => setGuide({ ...guide, [f.key]: e.target.value })} rows={f.rows} placeholder={f.placeholder} maxLength={1100} className={AREA} />
                </label>
              ))}
              <details className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">What the agent reads, made from these boxes</summary>
                <div className="mt-2 grid gap-2 text-xs">
                  <pre className="rounded-lg bg-background/60 p-2.5 leading-relaxed whitespace-pre-wrap">{composed.prompt}</pre>
                  {composed.labels.map((l) => (
                    <p key={l.name}>
                      <b className="font-mono">{l.name}</b>: {l.description}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          </Section>
        )}

        {mail && (
          <Section title={n(4, 'Keep safe')} description="These are checked in code before the model sees an email, so mail from them is never judged or moved.">
            <div className="grid gap-4">
              <SafeSendersCard rules={rules} setRules={setRules} accountIds={mailboxes} />
              <Field label="Always keep mail from these domains" hint="Type a domain and press Enter, for example example.org. Subdomains count too.">
                <TokenInput values={rules.protectedDomains} onChange={(v) => setRules({ protectedDomains: v })} placeholder="example.org" />
              </Field>
              <Field label="Always keep mail that mentions" hint="Whole words or phrases in the sender, the subject or the start of the message.">
                <TokenInput values={rules.protectedPhrases} onChange={(v) => setRules({ protectedPhrases: v })} placeholder="a name or phrase" />
              </Field>
            </div>
          </Section>
        )}

        {mail && (
          <Section title={n(5, 'What happens to spam')} description="Mail is only ever moved to Trash, never deleted: the provider keeps it there, so anything moved by mistake can be put back.">
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground sm:max-w-xs">
                Move to Trash when it is labelled
                <select value={action.trashLabel ?? ''} onChange={(e) => setAction({ trashLabel: e.target.value || null, auto: e.target.value ? action.auto : false })} className={SELECT}>
                  <option value="">Nothing: only label it</option>
                  {cfg.labels.filter((l) => l.name).map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={cn('flex items-start gap-2 text-sm', !action.trashLabel && 'opacity-50')}>
                <input type="checkbox" disabled={!action.trashLabel} checked={action.auto} onChange={(e) => setAction({ auto: e.target.checked })} className="mt-0.5 size-4 accent-[var(--foreground)]" />
                <span>
                  Move it by itself when it is sure
                  <span className="block text-xs text-muted-foreground">Off: it waits in Review until you approve it. A test run never moves anything.</span>
                </span>
              </label>
            </div>
          </Section>
        )}

        <Section title={n(6, 'Who decides')} description="Which model reads each email and says how sure it is, and how many it reads at a time.">
          <Deciding cfg={cfg} set={set} />
        </Section>

        {mail && guide && (
          <details className="rounded-2xl border bg-card/80 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">Advanced: the full prompt and the labels</summary>
            <p className="mt-2 text-xs text-muted-foreground">Editing the five boxes above rewrites these. Change them here only for fine control, such as a different confidence for each label.</p>
            <div className="mt-3">{rawSection}</div>
          </details>
        )}

        <Section title={n(7, 'The prompt')} description="Exactly what the model is sent for this setup, filled with two example emails. Nothing is asked of any model to show it.">
          <PromptView cfg={cfg} />
        </Section>

        {extra}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onSave({ name, description, config: cfg })} disabled={saving || !name.trim() || needsMailbox}>
            {saving ? <Spinner size="xs" tone="current" decorative /> : <Save />} {saveLabel}
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          {onDelete && (
            <Button variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
              <Trash2 /> Delete agent
            </Button>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
        <Section title="Try it" description="Runs this setup, as it is now, on a sample. Nothing is kept or changed.">
          <div className="grid gap-3">
            {manual && <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={6} placeholder={'Paste a few items to sort.\nSeparate them with a line of ---'} aria-label="Items to try" className={AREA} />}
            <Button onClick={() => void test()} disabled={testing || (manual && !sample.trim()) || needsMailbox} className="w-fit">
              {testing ? <Spinner size="xs" tone="current" decorative /> : <Play />} Test run
            </Button>
            {error && (
              <div role="alert" className="grid gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                {error}
                {/choose a provider/i.test(error) && (
                  <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<Link to="/agents/settings" />}>
                    <KeyRound /> Providers
                  </Button>
                )}
              </div>
            )}
            {run && <TestResults run={run} />}
          </div>
        </Section>
      </div>
    </div>
  )
}

const BATCHES = [
  { value: 1, label: 'One at a time' },
  { value: 10, label: '10 per request' },
  { value: 20, label: '20 per request' },
  { value: 30, label: '30 per request' },
  { value: 50, label: '50 per request' },
]

/** The decision model (or the agent's own), where it is reached, and how many items go in one request. */
function Deciding({ cfg, set }: { cfg: WorkflowConfig; set: (p: Partial<WorkflowConfig>) => void }) {
  const { settings } = useAgentSettings()
  const [connecting, setConnecting] = useState(false)
  const jev = cfg.decider === 'jev'
  const key = settings?.providers.openrouter
  const models = settings?.decisionModels ?? []
  const batch = cfg.batchSize ?? 1

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Decider" className="grid gap-2 sm:grid-cols-2">
        {[
          { id: 'jev' as const, title: 'Jev, the decision model', hint: 'Made to choose between options and say how sure it is.' },
          { id: 'model' as const, title: 'The agent’s own model', hint: 'A chat model from OpenAI, Gemini or OpenRouter, chosen in Settings.' },
        ].map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={cfg.decider === o.id} onClick={() => set({ decider: o.id })} className={cn('rounded-xl border p-3 text-left transition-colors', cfg.decider === o.id ? 'border-foreground/40 bg-background shadow-float' : 'hover:border-foreground/20')}>
            <span className="block text-sm font-medium">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </div>

      {jev ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-xs text-muted-foreground">
            Provider
            <div className="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm text-foreground">
              <span className="flex-1">OpenRouter</span>
              {key?.connected ? <span className="text-xs text-success">Connected {key.last4 ? `· …${key.last4}` : ''}</span> : <span className="text-xs text-warning">Not connected</span>}
            </div>
            <Button variant="ghost" size="xs" className="w-fit text-muted-foreground" onClick={() => setConnecting(true)}>
              <KeyRound /> {key?.connected ? 'Change the key' : 'Connect OpenRouter'}
            </Button>
          </div>
          <label className="grid content-start gap-1 text-xs text-muted-foreground">
            Decision model
            <select value={cfg.decisionModel ?? ''} onChange={(e) => set({ decisionModel: e.target.value || null })} className={SELECT}>
              <option value="">Your default{settings?.decision?.modelId ? ` (${models.find((m) => m.id === settings.decision?.modelId)?.name ?? settings.decision.modelId})` : ''}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <ProvidersDialog open={connecting} onOpenChange={setConnecting} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Choose its provider and model in this agent’s Settings once it is saved.</p>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground sm:max-w-xs">
        Emails per request
        <select value={batch} onChange={(e) => set({ batchSize: Number(e.target.value) })} className={SELECT}>
          {BATCHES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <span>{batch > 1 ? 'The instructions are sent once for the whole batch, so it costs less. An email the model skips is asked about alone.' : 'Every email is its own request: the most expensive way.'}</span>
      </label>
    </div>
  )
}

/** The prompt as the model gets it, built by the server with the same code that runs the agent. */
function PromptView({ cfg }: { cfg: WorkflowConfig }) {
  const { agent } = useServices()
  const [view, setView] = useState<PromptPreview | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      setView(await agent.promptPreview(cfg))
    } catch (e) {
      toast.error('Couldn’t build the prompt', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Couldn’t copy. Select it and copy by hand.'))
  const block = (title: string, text: string) => (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{title}</h4>
        <Button variant="ghost" size="icon-xs" aria-label={`Copy ${title}`} onClick={() => void copy(text)}>
          <Copy />
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed whitespace-pre-wrap">{text}</pre>
    </div>
  )

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
          {busy ? <Spinner size="xs" tone="current" decorative /> : view ? <RefreshCw /> : <Eye />} {view ? 'Refresh' : 'Show the prompt'}
        </Button>
        {view && (
          <span className="text-xs text-muted-foreground">
            {view.model ? `${view.model}` : 'No model chosen yet'}
            {view.provider ? ` via ${view.provider}` : ''} · {view.batched ? `${view.batchSize} emails per request` : 'one email per request'}
          </span>
        )}
      </div>
      {view && (
        <div className="grid gap-3">
          {view.system && block('Instructions, sent first', view.system)}
          {block(view.system ? (view.batched ? 'Then the emails (examples)' : 'Then the email (example)') : 'What the decision model reads (examples)', view.user)}
          {view.questions && block('Its questions, one per email', JSON.stringify(view.questions, null, 2))}
        </div>
      )}
    </div>
  )
}

/** Everything or a stretch of the inbox: the whole folder, the last few days, or between two dates. */
function WhichMail({ filters, setFilters }: { filters: WorkflowConfig['filters']; setFilters: (p: Partial<WorkflowConfig['filters']>) => void }) {
  const mode = filters.after || filters.before ? 'dates' : filters.sinceDays ? 'days' : 'all'
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const shift = (day: string, by: number) => {
    const d = new Date(`${day}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + by)
    return iso(d)
  }
  const pick = (m: 'all' | 'days' | 'dates') => {
    if (m === 'all') setFilters({ sinceDays: null, after: null, before: null })
    else if (m === 'days') setFilters({ sinceDays: 30, after: null, before: null })
    else setFilters({ sinceDays: null, after: iso(new Date(Date.now() - 30 * 86_400_000)), before: null })
  }
  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-xs text-muted-foreground">Which emails</span>
      <div role="radiogroup" aria-label="Which emails" className="flex flex-wrap gap-2">
        {[
          { id: 'all' as const, label: 'The whole inbox' },
          { id: 'days' as const, label: 'The last few days' },
          { id: 'dates' as const, label: 'Between two dates' },
        ].map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} onClick={() => pick(o.id)} className={cn('rounded-full border px-3 py-1.5 text-sm transition-colors', mode === o.id ? 'border-foreground/40 bg-background font-medium' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
            {o.label}
          </button>
        ))}
      </div>
      {mode === 'days' && (
        <select aria-label="How many days back" value={filters.sinceDays ?? 30} onChange={(e) => setFilters({ sinceDays: Number(e.target.value) })} className={cn(SELECT, 'w-fit')}>
          {[1, 7, 14, 30, 90, 180, 365, 1095].map((n) => (
            <option key={n} value={n}>
              {n === 1 ? 'Today and yesterday' : n >= 365 ? `The last ${n / 365 === 1 ? 'year' : `${Math.round(n / 365)} years`}` : `The last ${n} days`}
            </option>
          ))}
        </select>
      )}
      {mode === 'dates' && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <DateInput value={filters.after ?? undefined} onChange={(d) => setFilters({ after: d ?? null })} aria-label="From date" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Until (included)
            <DateInput value={filters.before ? shift(filters.before, -1) : undefined} onChange={(d) => setFilters({ before: d ? shift(d, 1) : null })} aria-label="Until date" />
          </label>
        </div>
      )}
      {mode === 'all' && <p className="text-xs text-muted-foreground">Every email in the inbox, newest first. It works through them a few at a time and never reads one twice.</p>}
    </div>
  )
}

/** The shield that keeps mail from anyone you have written to. It can be switched off, and you can see who it protects. */
function SafeSendersCard({ rules, setRules, accountIds }: { rules: NonNullable<WorkflowConfig['rules']>; setRules: (p: Partial<NonNullable<WorkflowConfig['rules']>>) => void; accountIds: string[] }) {
  const { agent } = useServices()
  const [found, setFound] = useState<SafeSenders[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function look() {
    setBusy(true)
    try {
      setFound(await agent.safeSenders(accountIds))
    } catch (e) {
      toast.error('Couldn’t read the Sent folders', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('grid gap-3 rounded-xl border p-3.5 transition-colors', rules.protectCorrespondents ? 'border-success/40 bg-success/5' : 'bg-muted/30')}>
      <div className="flex items-start gap-3">
        <ShieldCheck className={cn('mt-0.5 size-5 shrink-0', rules.protectCorrespondents ? 'text-success' : 'text-muted-foreground')} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Safe senders</div>
          <p className="text-xs text-muted-foreground">Anyone you have written to from these mailboxes is never judged or moved. It reads each mailbox’s Sent folder (the last 5,000 messages) every run, so new contacts are protected as soon as you write to them.</p>
        </div>
        <Switch checked={rules.protectCorrespondents} onChange={(on) => setRules({ protectCorrespondents: on })} label="Safe senders" />
      </div>

      {rules.protectCorrespondents ? (
        <div className="grid gap-2 pl-8">
          <Button variant="outline" size="sm" className="w-fit" disabled={busy || accountIds.length === 0} onClick={() => void look()}>
            {busy ? <Spinner size="xs" tone="current" decorative /> : <Eye />} Who is protected?
          </Button>
          {found?.map((f) => (
            <div key={f.accountId} className="text-xs">
              {f.error ? (
                <p className="text-destructive">{f.error}</p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    <b className="text-foreground tabular-nums">{f.count}</b> address{f.count === 1 ? '' : 'es'} protected{found.length > 1 ? ' in this mailbox' : ''}
                    {f.count > f.sample.length ? `, first ${f.sample.length} shown` : ''}.
                  </p>
                  {f.sample.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{f.sample.map((a) => <span key={a} className="rounded-md bg-muted px-1.5 py-0.5">{a}</span>)}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="pl-8 text-xs text-warning">Off: mail from people you know is judged like any other, so it can be moved to Trash.</p>
      )}

      <Field label="Also always keep these addresses" hint="For people you haven’t written to yet. Type an address and press Enter.">
        <TokenInput values={rules.protectedAddresses ?? []} onChange={(v) => setRules({ protectedAddresses: v })} placeholder="name@example.com" />
      </Field>
    </div>
  )
}
