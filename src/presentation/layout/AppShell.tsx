import { Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, CalendarRange, Menu, NotebookPen, Plus, Search, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation, useOutlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import { useAttention } from '@/presentation/app/attention'
import { useEditor } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import type { WorkspaceScope } from '@/presentation/app/workspaceFilter'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { KIND_META } from '@/presentation/components/kinds'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { easeOutExpo, spring } from '@/presentation/motion/presets'
import { AccountCard, SyncBanner } from './AccountCard'
import { CommandPalette } from './CommandPalette'
import { MobileTabBar } from './MobileTabBar'
import { SECTION_TITLES, useDocumentTitle } from './useDocumentTitle'
import { CREATE_MENU } from './createMenu'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  tone?: 'danger' | 'default'
}


export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()
  const section = location.pathname.split('/')[1] ?? ''
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Detail pages (e.g. /cases/:id) name the tab after the record themselves.
  const isDetail = section !== 'today' && location.pathname.split('/').filter(Boolean).length > 1
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
        <Sidebar onSearch={() => setPaletteOpen(true)} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onSearch={() => setPaletteOpen(true)} />
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
            <Suspense fallback={null}>{outlet}</Suspense>
          </motion.main>
        </AnimatePresence>
      </div>

      <MobileTabBar />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { open } = useEditor()
  const attention = useAttention()
  const { scope, setScope } = useWorkspaceFilter()

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Plan',
      items: [
        { to: '/today', label: 'Today', icon: Sun },
        { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      ],
    },
    {
      label: 'Execute',
      items: [
        { to: '/tasks', label: 'Tasks', icon: KIND_META.task.icon, badge: attention.overdueTasks.length, tone: 'danger' },
        { to: '/follow-ups', label: 'Follow-ups', icon: KIND_META.followUp.icon, badge: attention.dueFollowUps.length },
        { to: '/meetings', label: 'Meetings', icon: KIND_META.meeting.icon, badge: attention.meetingsToRecord.length },
      ],
    },
    {
      label: 'Legal',
      items: [
        { to: '/cases', label: 'Cases', icon: KIND_META.case.icon, badge: attention.hearingsToRecord.length, tone: 'danger' },
        { to: '/diary', label: 'Case diary', icon: NotebookPen },
        { to: '/counsel', label: 'Counsel', icon: KIND_META.counsel.icon },
      ],
    },
    {
      label: 'FSA',
      items: [{ to: '/clients', label: 'Clients & projects', icon: KIND_META.client.icon }],
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

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="px-2 pt-1">
        <Logo />
      </div>

      <div className="flex gap-1.5">
        <ActionMenu
          trigger={<Button className="flex-1 justify-start" size="sm" />}
          triggerContent={
            <>
              <Plus /> New
            </>
          }
          contentProps={{ className: 'w-52' }}
          items={CREATE_MENU.map((c, i) => ({ key: c.kind, label: c.label, icon: <c.icon />, separatorBefore: i === 4, onSelect: () => open({ kind: c.kind } as never) }))}
        />
        <Button variant="outline" size="sm" onClick={onSearch} aria-label="Search and commands" className="gap-1 px-2 text-muted-foreground">
          <Search /> <kbd className="text-[10px]">Ctrl K</kbd>
        </Button>
      </div>

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

        <div>
          <div className="mb-1 px-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground/80 uppercase">Workspace</div>
          <div className="grid gap-0.5" role="radiogroup" aria-label="Workspace filter">
            {scopes.map((s) => {
              const active = scope === s.id
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setScope(s.id)}
                  className={cn('relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors', active ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}
                >
                  {active && <motion.span layoutId="scope-active" transition={spring.snappy} className="absolute inset-0 rounded-lg bg-muted" />}
                  {s.id === 'all' ? <CalendarRange className="relative size-4" /> : <WorkspaceDot ws={s.id} className="relative mx-1" />}
                  <span className="relative">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <AccountCard />
    </div>
  )
}
