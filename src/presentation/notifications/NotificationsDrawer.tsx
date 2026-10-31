import { useEffect } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { AlertTriangle, Bell, CheckCircle2, Info, OctagonAlert, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { clearNotices, markAllRead, removeNotice, unreadProblems, useNotices } from './store'
import type { NoticeLevel } from './store'

const LEVEL: Record<NoticeLevel, { icon: typeof Info; tone: string; label: string }> = {
  error: { icon: OctagonAlert, tone: 'text-destructive', label: 'Error' },
  warning: { icon: AlertTriangle, tone: 'text-warning', label: 'Warning' },
  success: { icon: CheckCircle2, tone: 'text-success', label: 'Done' },
  info: { icon: Info, tone: 'text-muted-foreground', label: 'Note' },
}

/** The bell. A number on it means problems you haven't read yet. */
export function NotificationsButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const unread = unreadProblems(useNotices())
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={onOpen} className={cn('relative', className)} />}>
        <Bell />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums">{unread > 9 ? '9+' : unread}</span>}
      </TooltipTrigger>
      <TooltipContent side="bottom">Notifications</TooltipContent>
    </Tooltip>
  )
}

/** Everything the app has told you, newest first, with the errors that flashed by as toasts. */
export function NotificationsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const notices = useNotices()

  // What was on screen when the drawer closed has been seen.
  useEffect(() => {
    if (!open) markAllRead()
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-display text-2xl font-normal">Notifications</SheetTitle>
            <SheetDescription className="text-xs">Errors and updates, kept after their toast is gone.</SheetDescription>
          </div>
          {notices.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearNotices}>
              <Trash2 /> Clear
            </Button>
          )}
        </div>
        {notices.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <Bell className="size-7" />
            <p className="text-sm">Nothing yet. When something goes wrong, or an agent finishes, it is listed here.</p>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {notices.map((n) => {
              const l = LEVEL[n.level]
              return (
                <li key={n.id} className="group relative flex gap-3 px-4 py-3">
                  <l.icon className={cn('mt-0.5 size-4 shrink-0', l.tone)} aria-label={l.label} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm break-words', !n.read && 'font-medium')}>{n.title}</p>
                    {n.detail && <p className="mt-0.5 text-xs break-words text-muted-foreground">{n.detail}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDistanceToNowStrict(n.at, { addSuffix: true })}</p>
                  </div>
                  <Button size="icon-xs" variant="ghost" aria-label="Dismiss" onClick={() => removeNotice(n.id)} className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
                    <X />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
