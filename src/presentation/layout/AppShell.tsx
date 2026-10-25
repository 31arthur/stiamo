import { AnimatePresence, motion } from 'motion/react'
import { LogOut } from 'lucide-react'
import { NavLink, useLocation, useOutlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { easeOutExpo, spring } from '@/presentation/motion/presets'

export interface NavItem {
  to: string
  label: string
  /** Extra path prefixes that should mark this item active. */
  match?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Month' },
  { to: '/day', label: 'Day planner' },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const outlet = useOutlet()
  const section = location.pathname.split('/')[1] ?? ''
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="bg-ambient flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="relative flex items-center gap-1 rounded-full bg-muted/70 p-1 text-sm">
            {NAV_ITEMS.map((item) => {
              const active =
                item.to === '/' ? section === '' : [item.to, ...(item.match ?? [])].some((p) => location.pathname.startsWith(p))
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'relative rounded-full px-3.5 py-1 font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-background shadow-float"
                      transition={spring.snappy}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium">{user?.name}</div>
              <div className="text-muted-foreground">{user?.email}</div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-task to-meeting text-xs font-semibold text-white">
              {initials}
            </div>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={logout}
              aria-label="Sign out"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={section}
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.15 } }}
          transition={{ duration: 0.45, ease: easeOutExpo }}
          className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6"
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="6" className="fill-foreground" />
        <rect x="6" y="7" width="8" height="2.4" rx="1.2" className="fill-task" />
        <rect x="6" y="11" width="12" height="2.4" rx="1.2" className="fill-meeting" />
        <rect x="6" y="15" width="6" height="2.4" rx="1.2" className="fill-follow-up" />
      </svg>
      <span className="font-display text-xl tracking-tight">Stiamo</span>
    </div>
  )
}
