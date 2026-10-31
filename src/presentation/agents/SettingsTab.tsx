import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { Link, useNavigate } from '@/presentation/routing'
import { ModelPicker } from './ModelPicker'
import { PromptEditor } from './PromptEditor'
import { useAgentAction, useAgentSummary, useWorkflow } from './useAgent'
import { WorkspaceChips } from './WorkspaceChips'
import { WorkflowBuilder } from './WorkflowBuilder'
import type { WorkflowDraft } from './WorkflowBuilder'

/** What an agent runs on, and exactly what it is told. */
export function SettingsTab() {
  const { agentId } = useParams()
  const def = useAgentSummary(agentId)!
  if (def.kind === 'workflow') return <WorkflowSettings id={def.id} />
  return (
    <div className="grid gap-4">
      <ModelSection id={def.id} />
      <WorkspacesSection id={def.id} />
      <PromptEditor agentId={def.id} />
    </div>
  )
}

function ModelSection({ id, note }: { id: string; note?: string }) {
  const def = useAgentSummary(id)!
  return (
    <Section
      title="Model"
      description={note ?? (def.selectionInherited ? 'No choice of its own yet: it uses the model you chose last. Pick one to give this agent its own.' : 'The provider, model and how hard it thinks. Each agent has its own.')}
      actions={
        <Link to="/agents/settings" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          All agents’ settings
        </Link>
      }
    >
      <ModelPicker def={def} />
    </Section>
  )
}

/** Where an agent is listed. It can work in several workspaces, so these are toggles. */
function WorkspacesSection({ id }: { id: string }) {
  const def = useAgentSummary(id)!
  const set = useAgentAction((a, w: string[]) => a.setWorkspaces(id, w))
  return (
    <Section title="Workspaces" description="Where this agent is listed in the sidebar. It can work in several; “All workspaces” always lists every agent.">
      <WorkspaceChips value={def.workspaces} onChange={(w) => void set.run(w)} disabled={set.pending} />
    </Section>
  )
}

/** An agent someone built: change its setup (each change is a new version), or delete it. */
function WorkflowSettings({ id }: { id: string }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const navigate = useNavigate()
  const { data: w, isLoading } = useWorkflow(id)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  if (isLoading || !w) return <Spinner label="Loading" />

  async function save(d: WorkflowDraft) {
    setSaving(true)
    try {
      await agent.updateWorkflow(id, d.name, d.description, d.config)
      toast.success('Saved')
      await client.invalidateQueries({ queryKey: ['agent'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t save')
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    try {
      await agent.deleteWorkflow(id)
      await client.invalidateQueries({ queryKey: ['agent'] })
      toast.success('Agent deleted')
      navigate('/agents')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t delete')
    }
  }

  return (
    <div className="grid gap-4">
      <WorkflowBuilder
        key={`${w.id}:${w.version}:${w.name}`}
        initial={{ name: w.name, description: w.description, config: w.config }}
        saveLabel={`Save (version ${w.version})`}
        saving={saving}
        onSave={(d) => void save(d)}
        onDelete={() => setConfirming(true)}
        extra={
          <>
            {w.config.decider === 'model' ? <ModelSection id={id} /> : <p className="text-xs text-muted-foreground">It decides with Jev, through your OpenRouter key, so it has no model of its own to choose.</p>}
            <WorkspacesSection id={id} />
          </>
        }
      />
      {confirming && (
        <div role="alertdialog" aria-label="Delete this agent?" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          Delete {w.name}, its decisions and its history? This can’t be undone.
          <Button variant="destructive" size="sm" onClick={() => void remove()}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      )}
    </div>
  )
}
