import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useServices } from '@/presentation/app/services'
import { PageHeader } from '@/presentation/components/layout'
import { Link, useNavigate } from '@/presentation/routing'
import { WorkflowBuilder } from './WorkflowBuilder'
import type { WorkflowDraft } from './WorkflowBuilder'
import { TEMPLATES } from './workflowTemplates'
import type { WorkflowTemplate } from './workflowTemplates'

/** Build an agent: start from a template, shape it, try it on a sample, then save it. */
export function NewAgentPage() {
  const { agent } = useServices()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(d: WorkflowDraft) {
    setSaving(true)
    try {
      const w = await agent.createWorkflow(d.name, d.description, d.config)
      await client.invalidateQueries({ queryKey: ['agent'] })
      toast.success(`${w.name} is ready`)
      navigate(`/agents/${w.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t save the agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Agents" title="New agent" description="An agent that goes through a set of items, decides what each one is, and shows you its decisions to review." />
      {!template ? (
        <div className="grid gap-4">
          <h2 className="text-sm font-semibold">Start from</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setTemplate(t)} className="group flex h-full w-full flex-col gap-1.5 rounded-2xl border bg-card/80 p-4 text-left transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-float">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm text-muted-foreground">{t.description}</span>
                  <span className="mt-auto flex items-center gap-1 pt-2 text-xs text-muted-foreground">
                    {t.pitch} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4">
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setTemplate(null)}>
              <ArrowLeft /> Other starting points
            </Button>
          </div>
          <WorkflowBuilder
            key={template.id}
            initial={{ name: template.id === 'blank' ? '' : template.name, description: template.id === 'blank' ? '' : template.description, config: template.config }}
            saveLabel="Create agent"
            saving={saving}
            onSave={(d) => void save(d)}
            extra={
              <p className="text-xs text-muted-foreground">
                It runs on the model you chose last, or on Jev. Change it after saving, in the agent’s <Link to="/agents/settings" className="underline underline-offset-2">settings and providers</Link>.
              </p>
            }
          />
        </div>
      )}
    </>
  )
}
