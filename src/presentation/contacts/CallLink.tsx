import { Mail, MessageSquare, Phone } from 'lucide-react'
import { dialHref } from '@/domain/contacts/dial'
import type { DialChannel } from '@/domain/contacts/dial'
import { cn } from '@/lib/utils'

const ICON = { call: Phone, message: MessageSquare, email: Mail, visit: Phone } as const

/**
 * Who to reach, highlighted so it can be tapped: on a phone it opens the dialer with the number filled in (an iPhone asks you to
 * confirm before it dials), the messages app, or the mail app, depending on the kind of follow-up. With nothing to open it is just text.
 */
export function CallLink({ contact, channel = 'call', className }: { contact?: string; channel?: DialChannel; className?: string }) {
  if (!contact) return null
  const href = dialHref(contact, channel)
  if (!href) return <span className={cn('truncate', className)}>{contact}</span>
  const Icon = ICON[channel]
  return (
    <a
      href={href}
      // A row around it opens the record when clicked; tapping the number is not that.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={`${channel === 'message' ? 'Message' : channel === 'email' ? 'Email' : 'Call'} ${contact}`}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] leading-4 font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', className)}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{contact}</span>
    </a>
  )
}
