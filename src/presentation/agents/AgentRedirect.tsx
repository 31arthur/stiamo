import { useParams } from 'react-router-dom'
import { Navigate } from '@/presentation/routing'

/** An old address of an agent's page (Try it, Channels) goes to where that part lives now. */
export function AgentRedirect({ to }: { to: string }) {
  const { agentId } = useParams()
  return <Navigate to={`/agents/${agentId}${to}`} replace />
}
