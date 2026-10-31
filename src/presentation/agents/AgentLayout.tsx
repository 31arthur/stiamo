import { Activity, Bot, History, MessagesSquare, Play, Settings2 } from 'lucide-react'
import { Outlet, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/presentation/components/layout'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { Navigate, NavLink } from '@/presentation/routing'
import { useAgentSummary } from './useAgent'

const TABS = [
  { path: '', label: 'Overview', icon: Activity },
  { path: '/try', label: 'Try it', icon: Play },
  { path: '/settings', label: 'Settings', icon: Settings2 },
  { path: '/channels', label: 'Channels', icon: MessagesSquare },
  { path: '/history', label: 'History', icon: History },
]

/** One agent: who it is, and the tabs for how it has been doing, trying it, configuring it, its channels and its history. */
export function AgentLayout() {
  const { agentId } = useParams()
  const agent = useAgentSummary(agentId)
  useDocumentTitle(agent?.name)
  if (!agent) return <Navigate to="/agents" replace />
  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Bot className="size-3.5" /> Agent
          </span>
        }
        title={agent.name}
        description={agent.description}
      />
      <nav aria-label={`${agent.name} sections`} className="scrollbar-none -mt-2 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <NavLink key={t.path} to={`/agents/${agent.id}${t.path}`} end className={({ isActive }) => cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors', isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="size-4" /> {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
