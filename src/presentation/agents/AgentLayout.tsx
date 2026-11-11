import { Activity, Bot, History, Network, ListChecks, ListTree, Play, Settings2, Workflow } from 'lucide-react'
import { Outlet, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/presentation/components/layout'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { Navigate, NavLink } from '@/presentation/routing'
import { SweepWatcher } from './SweepPanel'
import { useAgentSummary, useReview, useSweep } from './useAgent'

/** Four places for an agent: how it is doing (and a chat to try it), how it works, what it has done, and how it is set up. */
const CHAT_TABS = [
  { path: '', label: 'Overview', icon: Activity },
  { path: '/workflow', label: 'Workflow', icon: Network },
  { path: '/history', label: 'Runs', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

/** An agent someone built has no chat or channels: it is run, and its decisions are reviewed. */
const WORKFLOW_TABS = [
  { path: '', label: 'Overview', icon: Activity },
  { path: '/run', label: 'Run', icon: Play },
  { path: '/review', label: 'Review', icon: ListChecks, badge: true },
  { path: '/executions', label: 'Runs', icon: ListTree },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

/** One agent: who it is, and the tabs for how it has been doing, trying it, configuring it, its channels and its history. */
export function AgentLayout() {
  const { agentId } = useParams()
  const agent = useAgentSummary(agentId)
  useDocumentTitle(agent?.name)
  const review = useReview(agentId, agent?.kind === 'workflow')
  const sweeping = useSweep(agent?.kind === 'workflow' ? agentId : undefined).data?.state === 'running'
  if (!agent) return <Navigate to="/agents" replace />
  const tabs = agent.kind === 'workflow' ? WORKFLOW_TABS : CHAT_TABS
  const waiting = review.data?.length ?? 0
  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            {agent.kind === 'workflow' ? <Workflow className="size-3.5" /> : <Bot className="size-3.5" />} {agent.kind === 'workflow' ? 'Agent you built' : 'Agent'}
          </span>
        }
        title={agent.name}
        description={agent.description}
      />
      <nav aria-label={`${agent.name} sections`} className="scrollbar-none -mt-2 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <NavLink key={t.path} to={`/agents/${agent.id}${t.path}`} end={t.path === ''} className={({ isActive }) => cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors', isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="size-4" /> {t.label}
            {t.path === '/executions' && sweeping && <span aria-label="Running through the inbox" className="size-2 animate-pulse rounded-full bg-success" />}
            {'badge' in t && waiting > 0 && <span className="rounded-full bg-foreground px-1.5 text-[10px] leading-4 font-semibold text-background tabular-nums">{waiting}</span>}
          </NavLink>
        ))}
      </nav>
      {agent.kind === 'workflow' && <SweepWatcher agentId={agent.id} name={agent.name} />}
      <Outlet />
    </>
  )
}
