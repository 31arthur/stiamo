import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Send } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Channel } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { ASSISTANT_ID } from '@/presentation/assistant/useChatAgents'
import { TelegramCard, WhatsAppCard } from '../ChannelsTab'
import { ProvidersPanel } from '../ProvidersPanel'
import { useChannels } from '../useAgent'

export type CredentialKind = 'telegram' | 'whatsapp' | 'provider'

export const CREDENTIAL_TYPES: { kind: CredentialKind; label: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { kind: 'telegram', label: 'Telegram bot', hint: 'Send and receive messages with a bot you made in @BotFather.', icon: Send, tone: 'text-sky-500' },
  { kind: 'whatsapp', label: 'WhatsApp number', hint: 'A Twilio WhatsApp number that only you can message.', icon: MessageCircle, tone: 'text-green-600' },
  { kind: 'provider', label: 'AI provider key', hint: 'OpenRouter, OpenAI, Anthropic… the key an AI agent runs on.', icon: Bot, tone: 'text-violet-600' },
]

/**
 * Where a credential is made or looked after, the way n8n does it: a window with what it connects to, the steps to connect, and what you
 * get once it is. It is made with the same calls as the Channels and Providers pages, so a credential made here is the same one there.
 * `kind` fixed: it is for that (a node asked for it); left out, you choose the type on the left. `channel` given: that credential is shown.
 */
export function CredentialModal({ open, onOpenChange, kind, channel, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; kind?: CredentialKind; channel?: Channel; onCreated?: (channelId: string) => void }) {
  const [picked, setPicked] = useState<CredentialKind>(kind ?? 'telegram')
  const { channels } = useChannels()
  const known = useRef<Set<string> | null>(null)
  // What existed when this window opened, so the bot made in it can be told from the rest and offered to the node that asked.
  useEffect(() => {
    if (open) {
      known.current = new Set(channels.map((c) => c.id))
      setPicked(kind ?? channel?.kind ?? 'telegram')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const active = channel ? channels.find((c) => c.id === channel.id) : undefined
  const fresh = !channel && open ? channels.find((c) => c.kind === picked && !known.current?.has(c.id)) : undefined
  const shown = active ?? fresh
  const told = useRef<string | null>(null)
  useEffect(() => {
    if (fresh && told.current !== fresh.id) {
      told.current = fresh.id
      onCreated?.(fresh.id)
    }
  }, [fresh, onCreated])

  const type = CREDENTIAL_TYPES.find((t) => t.kind === picked)!
  const choose = !kind && !channel
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-hidden p-0 sm:max-w-3xl" showCloseButton>
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-card">
            <type.icon className={cn('size-5', type.tone)} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold">{shown ? (shown.username ? `@${shown.username}` : type.label) : `New ${type.label}`}</DialogTitle>
            <DialogDescription className="text-xs">{type.label} · kept encrypted on your server, never sent back to the browser</DialogDescription>
          </div>
        </div>
        <div className={cn('grid min-h-0 sm:grid-cols-[13rem_minmax(0,1fr)]', !choose && 'sm:grid-cols-1')}>
          {choose && (
            <nav aria-label="Credential type" className="flex gap-1 overflow-x-auto border-b p-3 sm:grid sm:content-start sm:border-r sm:border-b-0">
              {CREDENTIAL_TYPES.map((t) => (
                <button key={t.kind} type="button" aria-current={picked === t.kind} onClick={() => setPicked(t.kind)} className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors', picked === t.kind ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
                  <t.icon className={cn('size-4', t.tone)} /> {t.label}
                </button>
              ))}
            </nav>
          )}
          <div className="max-h-[66dvh] min-w-0 overflow-y-auto p-5">
            <p className="mb-4 text-sm text-muted-foreground">{type.hint}</p>
            {picked === 'telegram' && <TelegramCard agentId={ASSISTANT_ID} channel={shown} />}
            {picked === 'whatsapp' && <WhatsAppCard agentId={ASSISTANT_ID} channel={shown} />}
            {picked === 'provider' && <ProvidersPanel compact />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
