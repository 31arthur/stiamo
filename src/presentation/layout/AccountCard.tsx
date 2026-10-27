import { useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { motion } from 'motion/react'
import { Cloud, CloudOff, Database, HardDrive, LogOut, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { useAction } from '@/presentation/data/hooks'
import { useSync } from '@/presentation/data/live'

export function initialsOf(name: string | undefined) {
  return (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Who's signed in, where the data lives and whether it's in sync. */
export function AccountCard() {
  const { user, logout } = useAuth()
  const sync = useSync()
  const [menuOpen, setMenuOpen] = useState(false)
  const seed = useAction<void, void>((s, userId) => s.seedSampleData(userId), { success: 'Sample practice added' })

  const status = sync.mode === 'local' ? { icon: HardDrive, label: 'This device only', tone: 'text-muted-foreground' } : sync.error ? { icon: CloudOff, label: 'Sync problem', tone: 'text-destructive' } : !sync.online ? { icon: CloudOff, label: 'Offline — will sync', tone: 'text-warning' } : { icon: Cloud, label: sync.ready ? 'Synced' : 'Connecting…', tone: 'text-success' }

  return (
    <div className="grid gap-1.5">
      <div className={cn('flex items-center gap-1.5 px-2.5 text-[11px]', status.tone)}>
        <span className="relative flex size-2">
          {sync.mode === 'supabase' && sync.online && !sync.error && (
            <motion.span className="absolute inset-0 rounded-full bg-current" animate={{ scale: [1, 2.4], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity }} />
          )}
          <span className="relative size-2 rounded-full bg-current" />
        </span>
        {sync.mode === 'supabase' && !sync.ready && !sync.error && sync.online ? <Spinner size="xs" tone="current" decorative /> : <status.icon className="size-3" />} {status.label}
      </div>
      <div className="flex items-center gap-2 rounded-xl border bg-background/60 p-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ws-sb to-ws-fsa text-xs font-semibold text-white">{initialsOf(user?.name)}</div>
        <div className="min-w-0 flex-1 text-xs leading-tight">
          <div className="truncate font-medium">{user?.name}</div>
          <div className="truncate text-muted-foreground">{user?.email}</div>
        </div>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Account menu" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{sync.mode === 'supabase' ? 'Cloud workspace' : 'Offline workspace'}</DropdownMenuLabel>
            <DropdownMenuItem closeOnClick={false} onClick={() => (setMenuOpen(false), seed.run())} disabled={seed.pending}>
              <Database /> Load sample practice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" closeOnClick={false} onClick={() => (setMenuOpen(false), logout())}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** Shown above the page when the backend can't be reached or isn't set up. */
export function SyncBanner() {
  const { error } = useSync()
  if (!error) return null
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <CloudOff className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span>
        <span className="font-medium">Can’t sync with the database.</span> {error}
      </span>
    </motion.div>
  )
}
