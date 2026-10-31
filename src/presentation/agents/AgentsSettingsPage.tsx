import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Workflow } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import type { AiSelection } from '@/domain/ai/types'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { PageHeader, Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { ModelChoice, ModelPicker } from './ModelPicker'
import { ProvidersPanel } from './ProvidersPanel'
import { useAgentSettings } from './useAgent'

/** Everything the agents share: connect the providers, then decide which model each agent runs on. */
export function AgentsSettingsPage() {
  const { settings, connected } = useAgentSettings()
  const agents = settings?.agents ?? []
  return (
    <>
      <PageHeader eyebrow="Agents" title="Settings" description="Connect the AI providers once, then choose the model each agent runs on. An agent’s own page lets you change just its model." />

      <Step n={1} title="Providers" description="Connect the ones you use. You can add more at any time.">
        <ProvidersPanel />
      </Step>

      <Step n={2} title="Models" description="Which provider and model each agent uses.">
        {connected.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Connect a provider above, then choose models here.</p>
        ) : (
          <div className="grid gap-4">
            <UseForAll agents={agents} />
            <ul className="grid divide-y rounded-2xl border bg-card/70">
              {agents.map((a) => (
                <li key={a.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-center">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">{a.kind === 'workflow' ? <Workflow className="size-4" /> : <Bot className="size-4" />}</span>
                    <div className="min-w-0">
                      <Link to={`/agents/${a.id}`} className="block truncate text-sm font-medium hover:underline">
                        {a.name}
                      </Link>
                      <span className={cn('block truncate text-xs', a.selection ? 'text-muted-foreground' : 'text-warning')}>{a.selection ? (a.selectionInherited ? 'Following the last choice' : 'Its own model') : 'No model yet'}</span>
                    </div>
                  </div>
                  <ModelPicker def={a} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Step>
    </>
  )
}

function Step({ n, title, description, children }: { n: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <header className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{n}</span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

/** One choice, applied to every agent: the quick way to set them all up. */
function UseForAll({ agents }: { agents: AgentSummary[] }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const [draft, setDraft] = useState<AiSelection | null>(null)
  const [busy, setBusy] = useState(false)

  async function apply() {
    if (!draft?.modelId) return
    setBusy(true)
    try {
      await Promise.all(agents.map((a) => agent.setSelection(a.id, draft)))
      await client.invalidateQueries({ queryKey: ['agent'] })
      toast.success(`${agents.length} agent${agents.length === 1 ? '' : 's'} now use ${draft.modelId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t change the models')
    } finally {
      setBusy(false)
    }
  }

  if (agents.length < 2) return null
  return (
    <Section title="One model for all" description="Pick a model, then apply it to every agent at once. You can still change any one afterwards." bodyClassName="flex flex-wrap items-center gap-3">
      <ModelChoice value={draft} onChange={setDraft} />
      <Button size="sm" onClick={() => void apply()} disabled={!draft?.modelId || busy}>
        Apply to all {agents.length} agents
      </Button>
    </Section>
  )
}
