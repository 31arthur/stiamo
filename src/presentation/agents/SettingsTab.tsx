import { useParams } from 'react-router-dom'
import { Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { ModelPicker } from './ModelPicker'
import { PromptEditor } from './PromptEditor'
import { useAgentSummary } from './useAgent'

/** What an agent runs on, and exactly what it is told. */
export function SettingsTab() {
  const { agentId } = useParams()
  const def = useAgentSummary(agentId)!
  return (
    <div className="grid gap-4">
      <Section
        title="Model"
        description={
          def.selectionInherited
            ? 'No choice of its own yet: it uses the model you chose last. Pick one to give this agent its own.'
            : 'The provider, model and how hard it thinks. Each agent has its own.'
        }
        actions={
          <Link to="/agents/providers" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Manage providers
          </Link>
        }
      >
        <ModelPicker def={def} />
      </Section>
      <PromptEditor agentId={def.id} />
    </div>
  )
}
