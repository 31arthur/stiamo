import { Bot, FileCode2, KeyRound, MessagesSquare, Scale } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { EmptyState, PageHeader, Section } from '@/presentation/components/layout'
import { NavLink } from '@/presentation/routing'
import { useAgentAvailable } from './useAgent'

const TABS = [
  { to: '/ai', label: 'Case agent', icon: Bot, end: true },
  { to: '/ai/prompt', label: 'Prompt', icon: FileCode2, end: false },
  { to: '/ai/decisions', label: 'Decisions', icon: Scale, end: false },
  { to: '/ai/channels', label: 'Channels', icon: MessagesSquare, end: false },
  { to: '/ai/providers', label: 'Providers', icon: KeyRound, end: false },
]

/** The AI section: a case agent to ask, its prompt, decision models, the chat channels, and the providers it runs on. */
export function AiLayout() {
  const available = useAgentAvailable()
  return (
    <>
      <PageHeader eyebrow="All workspaces · AI" title="AI agents" description="Ask about your cases and documents here, or from Telegram and WhatsApp. Bring your own provider, choose the model, and edit exactly what the agent is told." />
      <nav aria-label="AI" className="scrollbar-none -mt-2 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors', isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="size-4" /> {t.label}
          </NavLink>
        ))}
      </nav>
      {available ? (
        <Outlet />
      ) : (
        <Section>
          <EmptyState title="The agent needs the Stiamo backend">Your keys, the prompt and the chat channels are kept on the server, so the agent isn’t available in the offline demo.</EmptyState>
        </Section>
      )}
    </>
  )
}
