import { useState } from 'react'
import type { ReactNode } from 'react'
import { KeyRound, Play, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { WorkflowConfig, WorkflowRun } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
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
  const dirty = JSON.stringify({ name, description, cfg }) !== JSON.stringify({ name: initial.name, description: initial.description, cfg: initial.config })

  async function test() {
    setTesting(true)
    setError(null)
    try {
      setRun(await agent.testDraft(cfg, manual ? sample : undefined))
    } catch (e) {
      setRun(null)
      setError(e instanceof Error ? e.message : 'The test failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="grid content-start gap-4">
        <Section title="About">
          <div className="grid gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Task triage" aria-label="Name" maxLength={100} />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it is for, in a line" aria-label="Description" maxLength={300} />
          </div>
        </Section>

        <Section title="What it reads" description="The items it goes through each time. Filters are applied in code first, so you only pay for the items that matter.">
          <div className="grid gap-4">
            <div role="radiogroup" aria-label="Source" className="grid gap-2 sm:grid-cols-2">
              {[
                { kind: 'manual' as const, title: 'Text you paste', hint: 'To try an idea. Separate items with a line of ---.' },
                { kind: 'table' as const, title: 'A Stiamo collection', hint: 'Your cases, tasks, follow-ups, meetings, clients or projects.' },
              ].map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  role="radio"
                  aria-checked={cfg.source.kind === o.kind}
                  onClick={() => set({ source: { kind: o.kind, table: o.kind === 'table' ? (cfg.source.table ?? 'tasks') : null }, filters: { ...cfg.filters, newOnly: o.kind === 'table' } })}
                  className={cn('rounded-xl border p-3 text-left transition-colors', cfg.source.kind === o.kind ? 'border-foreground/40 bg-background shadow-float' : 'hover:border-foreground/20')}
                >
                  <span className="block text-sm font-medium">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">Email and news feeds are coming: they will be sources here too.</p>
            </div>

            {!manual && (
              <div className="grid gap-3 sm:grid-cols-2">
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
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Only if it contains
                  <Input value={cfg.filters.contains ?? ''} onChange={(e) => setFilters({ contains: e.target.value || null })} placeholder="a word (optional)" maxLength={100} className="h-8" />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  At most
                  <Input type="number" min={1} max={200} value={cfg.filters.limit} onChange={(e) => setFilters({ limit: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })} className="h-8" />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={cfg.filters.newOnly} onChange={(e) => setFilters({ newOnly: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
                  Skip items it has already decided
                </label>
              </div>
            )}
          </div>
        </Section>

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

            <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Who decides
                <select value={cfg.decider} onChange={(e) => set({ decider: e.target.value as 'model' | 'jev' })} className={SELECT}>
                  <option value="model">This agent’s model (answers in words)</option>
                  <option value="jev">Jev, the decision model (answers in probabilities)</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Unsure below {Math.round(cfg.defaultThreshold * 100)}%: send to review
                <input type="range" min={0} max={100} step={5} value={Math.round(cfg.defaultThreshold * 100)} onChange={(e) => set({ defaultThreshold: Number(e.target.value) / 100 })} className="accent-[var(--foreground)]" aria-label="Default confidence needed" />
              </label>
            </div>
          </div>
        </Section>

        {extra}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onSave({ name, description, config: cfg })} disabled={saving || !name.trim()}>
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

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Section title="Try it" description="Runs this setup, as it is now, on a sample. Nothing is kept or changed.">
          <div className="grid gap-3">
            {manual && <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={6} placeholder={'Paste a few items to sort.\nSeparate them with a line of ---'} aria-label="Items to try" className={AREA} />}
            <Button onClick={() => void test()} disabled={testing || (manual && !sample.trim())} className="w-fit">
              {testing ? <Spinner size="xs" tone="current" decorative /> : <Play />} Test run
            </Button>
            {error && (
              <div role="alert" className="grid gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                {error}
                {/choose a provider|add an openrouter key/i.test(error) && (
                  <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<Link to="/agents/providers" />}>
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
