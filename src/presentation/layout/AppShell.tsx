import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CalendarDays, CalendarRange, ChevronsUpDown, LayoutDashboard, Mail, Menu, NotebookPen, Search, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLocation, useOutlet } from 'react-router-dom'
import { NavLink } from '@/presentation/routing'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import { useAttention } from '@/presentation/app/attention'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import type { WorkspaceScope } from '@/presentation/app/workspaceFilter'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { KIND_META } from '@/presentation/components/kinds'
import { PageLoader } from '@/presentation/components/loading'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useSync } from '@/presentation/data/live'
import { easeOutExpo, spring } from '@/presentation/motion/presets'
import { AccountCard, SyncBanner } from './AccountCard'
import { CommandPalette } from './CommandPalette'
import { MobileTabBar } from './MobileTabBar'
import { SECTION_TITLES, useDocumentTitle } from './useDocumentTitle'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  tone?: 'danger' | 'default'
}


/**
 * Holds the page back until the first snapshot of every collection has arrived, so a list never
 * flashes "nothing here" while its data is on the way. If a collection never answers (a missing
 * table, say) the page shows after a few seconds anyway, with the sync banner saying what's wrong.
 */
function SyncGate({ children }: { children: ReactNode }) {
  const { ready, error } = useSync()
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    if (ready) return
    const id = setTimeout(() => setGaveUp(true), 8000)
    return () => clearTimeout(id)
  }, [ready])
  if (!ready && !error && !gaveUp) return <PageLoader label="Loading your practice…" />
  return <>{children}</>
}

export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()
  // /:workspace/:section/…
  const segments = location.pathname.split('/').filter(Boolean)
  const section = segments[1] ?? ''
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Detail pages (e.g. /cases/:id) name the tab after the record themselves.
  const isDetail = section !== 'today' && segments.length > 2
  useDocumentTitle(isDetail ? undefined : (SECTION_TITLES[section] ?? ''))

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="bg-ambient flex min-h-dvh">
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 border-r lg:block">
        <Sidebar />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] lg:hidden">
          <Button variant="ghost" size="icon-sm" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <Logo />
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Search" onClick={() => setPaletteOpen(true)}>
            <Search />
          </Button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={section}
            initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -4, filter: 'blur(4px)', transition: { duration: 0.12 } }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:gap-6 sm:px-8 sm:pt-6 lg:pb-8"
          >
            <SyncBanner />
            <SyncGate>
              <Suspense fallback={<PageLoader />}>{outlet}</Suspense>
            </SyncGate>
          </motion.main>
        </AnimatePresence>
      </div>

      <MobileTabBar />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

function Sidebar() {
  const attention = useAttention()
  const { scope, setScope } = useWorkspaceFilter()

  // Each workspace owns its section; the others stay out of the way. "All workspaces" shows the overview instead.
  const workspaceGroup: { label: string; items: NavItem[] } | null =
    scope === 'sb'
      ? {
          label: WORKSPACES.sb.name,
          items: [
            { to: '/letters', label: 'Letters', icon: Mail },
            { to: '/cases', label: 'Cases', icon: KIND_META.case.icon, badge: attention.hearingsToRecord.length, tone: 'danger' },
            { to: '/diary', label: 'Case diary', icon: NotebookPen },
            { to: '/counsel', label: 'Counsel', icon: KIND_META.counsel.icon },
          ],
        }
      : scope === 'fsa'
        ? {
            label: WORKSPACES.fsa.name,
            items: [
              { to: '/clients', label: 'Clients', icon: KIND_META.client.icon },
              { to: '/projects', label: 'Projects', icon: KIND_META.project.icon },
            ],
          }
        : null

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Plan',
      items: [
        ...(scope === 'all' ? [{ to: '/overview', label: 'Overview', icon: LayoutDashboard }] : []),
        { to: '/today', label: 'Today', icon: Sun },
        { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      ],
    },
    ...(workspaceGroup ? [workspaceGroup] : []),
    {
      label: 'Execute',
      items: [
        { to: '/tasks', label: 'Tasks', icon: KIND_META.task.icon, badge: attention.overdueTasks.length, tone: 'danger' },
        { to: '/follow-ups', label: 'Follow-ups', icon: KIND_META.followUp.icon, badge: attention.dueFollowUps.length },
        { to: '/meetings', label: 'Meetings', icon: KIND_META.meeting.icon, badge: attention.meetingsToRecord.length },
      ],
    },
    {
      label: 'Direction',
      items: [
        { to: '/plans', label: 'Action plans', icon: KIND_META.plan.icon },
        { to: '/goals', label: 'Goals', icon: KIND_META.goal.icon },
      ],
    },
  ]

  const scopes: { id: WorkspaceScope; label: string }[] = [{ id: 'all', label: 'All workspaces' }, ...WORKSPACE_IDS.map((id) => ({ id, label: WORKSPACES[id].name }))]
  const current = scopes.find((s) => s.id === scope)!

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="px-2 pt-1">
        <Logo />
      </div>

      <ActionMenu
        trigger={<Button variant="outline" className="w-full justify-start gap-2 px-2.5" aria-label={`Workspace: ${current.label}. Change`} />}
        triggerContent={
          <>
            {scope === 'all' ? <CalendarRange className="size-4" /> : <WorkspaceDot ws={scope} className="mx-1" />}
            <span className="flex-1 truncate text-left">{current.label}</span>
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </>
        }
        contentProps={{ className: 'w-56', align: 'start' }}
        items={scopes.map((s) => ({
          key: s.id,
          label: (
            <>
              <span className="flex-1">{s.label}</span>
              {scope === s.id && <Check className="size-4" />}
            </>
          ),
          icon: s.id === 'all' ? <CalendarRange className="size-4" /> : <WorkspaceDot ws={s.id} className="mx-1" />,
          separatorBefore: s.id === WORKSPACE_IDS[0],
          onSelect: () => setScope(s.id),
        }))}
      />

      <nav className="scrollbar-thin -mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-1 px-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground/80 uppercase">{g.label}</div>
            <div className="grid gap-0.5">
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} className="group relative">
                  {({ isActive }) => (
                    <span className={cn('relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors', isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
                      {isActive && <motion.span layoutId="sidebar-active" transition={spring.snappy} className="absolute inset-0 rounded-lg bg-background shadow-float" />}
                      <item.icon className="relative size-4" />
                      <span className="relative flex-1">{item.label}</span>
                      <AnimatePresence>
                        {!!item.badge && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={spring.snappy}
                            className={cn(
                              'relative min-w-5 rounded-full px-1.5 text-center text-[10px] leading-5 font-semibold tabular-nums',
                              item.tone === 'danger' ? 'bg-destructive text-white' : 'bg-foreground text-background',
                            )}
                          >
                            {item.badge}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <AccountCard />
    </div>
  )
}
