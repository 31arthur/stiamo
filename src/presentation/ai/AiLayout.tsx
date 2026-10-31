import { Bot, KeyRound } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/presentation/components/layout'
import { NavLink } from '@/presentation/routing'

const TABS = [
  { to: '/ai', label: 'Case agent', icon: Bot, end: true },
  { to: '/ai/providers', label: 'Providers', icon: KeyRound, end: false },
]

/** The AI section: a case agent to ask, and the providers and models it runs on. */
export function AiLayout() {
  return (
    <>
      <PageHeader eyebrow="All workspaces · AI" title="AI agents" description="Ask about your cases and the documents that go with them. Bring your own provider, then choose the model and how hard it thinks." />
      <nav aria-label="AI" className="-mt-2 flex gap-1 border-b">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors', isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="size-4" /> {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
