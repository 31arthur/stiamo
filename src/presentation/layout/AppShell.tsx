import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, Code2, Newspaper, Check, CalendarDays, CalendarRange, ChevronRight, ChevronsUpDown, LayoutDashboard, Inbox, Mail, Menu, NotebookPen, Search, SlidersHorizontal, Sparkles, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Navigate, useLocation, useOutlet } from 'react-router-dom'
import { NavLink } from '@/presentation/routing'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { firstEnabled } from '@/domain/shared/pages'
import { WORKSPACE_IDS, WORKSPACES, isScope } from '@/domain/shared/workspace'
import { useAttention } from '@/presentation/app/attention'
import { NotificationsButton, NotificationsDrawer } from '@/presentation/notifications/NotificationsDrawer'
import { usePages } from '@/presentation/app/pages'
import { useServices } from '@/presentation/app/services'
import { useAgentAttention } from '@/presentation/agents/useAgent'
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
import { PopOut } from '@/presentation/components/PopOut'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  tone?: 'danger' | 'default'
  /** Active only on exactly this address, not on what is under it. */
  end?: boolean
  /** Offers a button beside it that opens it in a new tab. */
  popout?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
  /** A small button beside the heading, for the thing you most often add here. */
  action?: { to: string; label: string; icon: LucideIcon }
  /** Parts of the group that fold away, shown after the first `at` items of the first one. */
  folds?: { key: string; label: string; at: number; items: NavItem[]; empty: string; title?: string }[]
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
  const scope = isScope(segments[0]) ? segments[0] : 'all'
  const { enabled, hidden } = usePages()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
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

  // A page switched off for this workspace isn't reachable by an old link either.
  if (!enabled(scope, section)) return <Navigate to={`/${scope}/${firstEnabled(hidden, scope)}`} replace />

  return (
    <div className="bg-ambient flex min-h-dvh">
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 border-r lg:block">
        <Sidebar onNotes={() => setNotesOpen(true)} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNotes={() => setNotesOpen(true)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] lg:hidden">
          <Button variant="ghost" size="icon-sm" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <Logo />
          <NotificationsButton onOpen={() => setNotesOpen(true)} className="ml-auto" />
          <Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setPaletteOpen(true)}>
            <Search />
          </Button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={segments.slice(1, 3).join('/')}
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
      <NotificationsDrawer open={notesOpen} onOpenChange={setNotesOpen} />
    </div>
  )
}

function Sidebar({ onNotes }: { onNotes: () => void }) {
  const attention = useAttention()
  const { scope, setScope } = useWorkspaceFilter()
  const { backend } = useServices()
  const { enabled } = usePages()
  const on = (page: string) => enabled(scope, page)
  const waiting = useAgentAttention(scope === 'sb' ? 'sb' : undefined, scope === 'sb').data?.count ?? 0

  // Each workspace owns its section; the others stay out of the way. "All workspaces" shows the overview instead.
  // What belongs to a workspace is grouped by what it is, not labelled with the workspace's name: you already chose the workspace.
  const workspaceGroups: NavGroup[] =
    scope === 'sb'
      ? [
          {
            label: 'Matters',
            items: [
              { to: '/cases', label: 'Cases', icon: KIND_META.case.icon, badge: attention.hearingsToRecord.length, tone: 'danger' },
              { to: '/diary', label: 'Case diary', icon: NotebookPen },
              { to: '/counsel', label: 'Counsel', icon: KIND_META.counsel.icon },
            ],
          },
          { label: 'Documents', items: [{ to: '/letters', label: 'Letters', icon: Mail }] },
        ]
      : scope === 'fsa'
        ? [
            {
              label: 'Delivery',
              items: [
                { to: '/clients', label: 'Clients', icon: KIND_META.client.icon },
                { to: '/projects', label: 'Projects', icon: KIND_META.project.icon },
              ],
            },
          ]
        : []

  // The S&B desk's own section: what its agents found in the mail and in the news. Not in the other workspaces.
  const monitoring: NavGroup[] =
    backend === 'api' && scope === 'sb'
      ? [{ label: 'Monitoring', items: [{ to: '/attention', label: 'Attention', icon: BellRing, badge: waiting }, { to: '/news', label: 'News', icon: Newspaper }] }]
      : []

  const groups: NavGroup[] = [
    {
      label: 'Plan',
      items: [
        ...(scope === 'all' ? [{ to: '/overview', label: 'Overview', icon: LayoutDashboard }] : []),
        ...(backend === 'api' ? [{ to: '/assistant', label: 'Assistant', icon: Sparkles, popout: true }] : []),
        { to: '/today', label: 'Today', icon: Sun },
        { to: '/calendar', label: 'Calendar', icon: CalendarDays },
        ...(backend === 'api' ? [{ to: '/mail', label: 'Mail', icon: Inbox }] : []),
      ].filter((i) => on(i.to.slice(1))),
      action: scope === 'all' ? { to: '/pages', label: 'Choose each workspace’s pages', icon: SlidersHorizontal } : undefined,
    },
    ...workspaceGroups,
    ...monitoring,
    {
      label: 'Execute',
      items: [
        { to: '/tasks', label: 'Tasks', icon: KIND_META.task.icon, badge: attention.overdueTasks.length, tone: 'danger' },
        { to: '/follow-ups', label: 'Follow-ups', icon: KIND_META.followUp.icon, badge: attention.dueFollowUps.length },
        { to: '/meetings', label: 'Meetings', icon: KIND_META.meeting.icon, badge: attention.meetingsToRecord.length },
      ].filter((i) => on(i.to.slice(1))),
    },
    {
      label: 'Direction',
      items: [
        { to: '/plans', label: 'Action plans', icon: KIND_META.plan.icon },
        { to: '/goals', label: 'Goals', icon: KIND_META.goal.icon },
      ].filter((i) => on(i.to.slice(1))),
    },
    // Building and tuning the agents is a place of its own, with its own sidebar.
    ...(backend === 'api' ? [{ label: 'Tools', items: [{ to: '/agents', label: 'Developer', icon: Code2, popout: true }] }] : []),
  ]

  const scopes: { id: WorkspaceScope; label: string }[] = [{ id: 'all', label: 'All workspaces' }, ...WORKSPACE_IDS.map((id) => ({ id, label: WORKSPACES[id].name }))]
  const current = scopes.find((s) => s.id === scope)!

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo />
        <NotificationsButton onOpen={onNotes} className="max-lg:hidden" />
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

      <nav className="scrollbar-none -mx-1 flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-1">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/80 uppercase">{g.label}</span>
              {g.action && (
                <Tooltip>
                  <TooltipTrigger render={<NavLink to={g.action.to} aria-label={g.action.label} className="-mr-1 flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />}>
                    <g.action.icon className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">{g.action.label}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="grid gap-0.5">
              {g.items.slice(0, g.folds?.[0].at ?? g.items.length).map((item) => (
                <NavRow key={item.to} item={item} />
              ))}
              {g.folds?.map((f) => <Fold key={f.key} fold={f} />)}
              {g.folds && g.items.slice(g.folds[0].at).map((item) => <NavRow key={item.to} item={item} />)}
            </div>
          </div>
        ))}
      </nav>

      <AccountCard />
    </div>
  )
}

function NavRow({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  return item.popout ? (
    <div className="group/row relative">
      <NavLinkRow item={item} nested={nested} />
      <PopOut to={item.to} label={item.label} className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-lg:opacity-100" />
    </div>
  ) : (
    <NavLinkRow item={item} nested={nested} />
  )
}

function NavLinkRow({ item, nested }: { item: NavItem; nested: boolean }) {
  return (
    <NavLink to={item.to} end={item.end} className="group relative">
      {({ isActive }) => (
        <span className={cn('relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors', nested && 'py-1', isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
          {isActive && <motion.span layoutId="sidebar-active" transition={spring.snappy} className="absolute inset-0 rounded-lg bg-background shadow-float" />}
          <item.icon className="relative size-4" />
          <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
          <AnimatePresence>
            {!!item.badge && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={spring.snappy}
                className={cn('relative min-w-5 rounded-full px-1.5 text-center text-[10px] leading-5 font-semibold tabular-nums', item.tone === 'danger' ? 'bg-destructive text-white' : 'bg-foreground text-background')}
              >
                {item.badge}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      )}
    </NavLink>
  )
}

const FOLD_KEY = 'stiamo.nav.fold.'

/** A part of the sidebar that folds away. It remembers whether it was open, and opens itself when you are inside it. */
function Fold({ fold }: { fold: NonNullable<NavGroup['folds']>[number] }) {
  const here = useLocation().pathname
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(FOLD_KEY + fold.key) !== 'closed'
    } catch {
      return true
    }
  })
  const inside = fold.items.some((i) => here.includes(i.to.replace(/^\//, '')))
  // Going into one of its pages opens it; after that it opens and closes only when you say so (so a fold you are inside can still be closed).
  const [wasInside, setWasInside] = useState(inside)
  if (inside !== wasInside) {
    setWasInside(inside)
    if (inside) setOpen(true)
  }
  const shown = open
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(FOLD_KEY + fold.key, open ? 'closed' : 'open')
    } catch {
      // Remembering it is a convenience.
    }
  }
  return (
    <div>
      <button type="button" onClick={toggle} aria-expanded={shown} title={fold.title} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
        <ChevronRight className={cn('size-4 transition-transform', shown && 'rotate-90')} />
        <span className="flex-1 text-left">{fold.label}</span>
        <span className="rounded-full bg-muted px-1.5 text-[10px] leading-5 font-medium tabular-nums">{fold.items.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="mt-0.5 ml-[1.15rem] grid grid-cols-[minmax(0,1fr)] gap-0.5 border-l pl-2">
              {fold.items.length === 0 ? <span className="px-2.5 py-1 text-xs text-muted-foreground">{fold.empty}</span> : fold.items.map((item) => <NavRow key={item.to} item={item} nested />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
