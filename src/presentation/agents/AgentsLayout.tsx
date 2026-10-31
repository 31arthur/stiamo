import { RefreshCw } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useAgentAvailable, useAgentSettings } from './useAgent'

/** Everything under /agents: only there with the backend, and only once the agent service has answered. */
export function AgentsLayout() {
  const available = useAgentAvailable()
  const { settings, loading, error } = useAgentSettings()
  const client = useQueryClient()

  if (!available) {
    return (
      <Section>
        <EmptyState title="Agents need the Stiamo backend">Your keys, prompts and chat channels are kept on the server, so agents aren’t available in the offline demo.</EmptyState>
      </Section>
    )
  }
  if (loading) return <Spinner label="Loading agents" />
  if (!settings) {
    return (
      <Section>
        <EmptyState
          title="The agent service isn’t answering"
          action={
            <Button variant="outline" onClick={() => void client.invalidateQueries({ queryKey: ['agent'] })}>
              <RefreshCw /> Try again
            </Button>
          }
        >
          {error ?? 'It may not be deployed yet.'} Once it is running, your agents appear here.
        </EmptyState>
      </Section>
    )
  }
  return <Outlet />
}
