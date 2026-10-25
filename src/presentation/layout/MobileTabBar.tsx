import { motion } from 'motion/react'
import { CalendarDays, Plus, Sun } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { cn } from '@/lib/utils'
import { useAttention } from '@/presentation/app/attention'
import { useEditor } from '@/presentation/app/create'
import { KIND_META } from '@/presentation/components/kinds'
import { spring } from '@/presentation/motion/presets'
import { CREATE_MENU } from './createMenu'

/** Thumb-reach navigation for phones: the four most-used places and a create button in the middle. */
export function MobileTabBar() {
  const { open } = useEditor()
  const attention = useAttention()
  const items = [
    { to: '/today', label: 'Today', icon: Sun, badge: 0 },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays, badge: 0 },
    null,
    { to: '/tasks', label: 'Tasks', icon: KIND_META.task.icon, badge: attention.overdueTasks.length + attention.dueFollowUps.length },
    { to: '/cases', label: 'Cases', icon: KIND_META.case.icon, badge: attention.hearingsToRecord.length },
  ]

  return (
    <nav aria-label="Primary" className="glass fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {items.map((item) =>
          item === null ? (
            <ActionMenu
              key="new"
              trigger={
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={spring.snappy}
                  aria-label="Create"
                  className="mx-auto flex size-12 -translate-y-3 items-center justify-center rounded-2xl bg-foreground text-background shadow-lift"
                />
              }
              triggerContent={<Plus className="size-6" />}
              contentProps={{ side: 'top', align: 'center', className: 'mb-2 w-56' }}
              itemClassName="py-2"
              items={CREATE_MENU.map((c, i) => ({ key: c.kind, label: c.label, icon: <c.icon />, separatorBefore: i === 4, onSelect: () => open({ kind: c.kind } as never) }))}
            />
          ) : (
            <NavLink key={item.to} to={item.to} className="relative flex h-full flex-col items-center justify-center gap-0.5">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="tab-active" transition={spring.snappy} className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" />}
                  <span className="relative">
                    <item.icon className={cn('size-5', isActive ? 'text-foreground' : 'text-muted-foreground')} />
                    {item.badge > 0 && <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] leading-4 font-semibold text-white tabular-nums">{item.badge}</span>}
                  </span>
                  <span className={cn('text-[10px]', isActive ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{item.label}</span>
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}
