import { Suspense, useEffect, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Bot, Coins, LayoutGrid, Menu, Plus, SlidersHorizontal, Sparkles, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/presentation/components/loading'
import { OpenApp } from '@/presentation/components/OpenApp'
import { Logo } from '@/presentation/layout/Logo'
import { Link, NavLink } from '@/presentation/routing'
import { useAgentAvailable, useAgentSettings } from './useAgent'

/**
 * Where the agents are built and tuned: their models, prompts, channels, history and cost. It has the whole screen to itself, with
 * its own sidebar. Talking to the agents is the Assistant; this is the workshop behind it.
 */
export function DeveloperShell() {
  const outlet = useOutlet()
  const [open, setOpen] = useState(false)
  const here = useLocation().pathname
  useEffect(() => setOpen(false), [here])

  return (
    <div className="bg-ambient flex h-dvh overflow-hidden">
      <aside className="glass hidden w-64 shrink-0 border-r lg:block">
        <DeveloperSidebar />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Developer</SheetTitle>
          <DeveloperSidebar />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass flex h-12 shrink-0 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] lg:hidden">
          <Button variant="ghost" size="icon-sm" aria-label="Open the menu" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <span className="font-display text-lg">Developer</span>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <motion.div key={here.split('/')[3] ?? 'home'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 pb-16 sm:gap-6 sm:px-8 sm:py-8">
            <Suspense fallback={<PageLoader />}>{outlet}</Suspense>
          </motion.div>
        </main>
      </div>
    </div>
  )
}

function Item({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors', isActive ? 'bg-foreground/[0.07] font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </NavLink>
  )
}

function DeveloperSidebar() {
  const available = useAgentAvailable()
  const { settings } = useAgentSettings()
  const agents = settings?.agents ?? []
  const team = agents.filter((a) => a.kind !== 'workflow')
  const force = agents.filter((a) => a.kind === 'workflow')

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between px-1 pt-1">
        <Logo />
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link to="/today" />} className="text-muted-foreground">
          <ArrowLeft /> Stiamo
        </Button>
      </div>

      <div className="px-2.5">
        <h1 className="font-display text-2xl">Developer</h1>
        <p className="text-xs text-muted-foreground">Build and tune the agents.</p>
      </div>

      <nav aria-label="Developer" className="scrollbar-none -mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1">
        <div className="grid gap-0.5">
          <Item to="/agents" label="All agents" icon={LayoutGrid} end />
          <Item to="/agents/usage" label="Usage and cost" icon={Coins} />
          <Item to="/agents/settings" label="Providers and models" icon={SlidersHorizontal} />
        </div>

        {available && (
          <>
            <Group label="Team" empty="No agents yet" items={team.map((a) => ({ to: `/agents/${a.id}`, label: a.name, icon: Bot }))} />
            <Group label="Task force" empty="No task force yet" items={force.map((a) => ({ to: `/agents/${a.id}`, label: a.name, icon: Workflow }))} />
          </>
        )}
      </nav>

      <div className="grid gap-1">
        <Button nativeButton={false} render={<Link to="/agents/new" />} variant="outline" className="w-full justify-start gap-2">
          <Plus /> New agent
        </Button>
        <OpenApp to="/assistant" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
          <Sparkles className="size-4" /> Open the Assistant
        </OpenApp>
      </div>
    </div>
  )
}

function Group({ label, items, empty }: { label: string; items: { to: string; label: string; icon: LucideIcon }[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-1 px-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground/80 uppercase">{label}</h2>
      <div className="grid gap-0.5">
        {items.length === 0 ? <p className="px-2.5 py-1 text-xs text-muted-foreground">{empty}</p> : items.map((i) => <Item key={i.to} {...i} />)}
      </div>
    </section>
  )
}
