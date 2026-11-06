import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { TelegramCard, WhatsAppCard } from '@/presentation/agents/ChannelsTab'
import { useChannels } from '@/presentation/agents/useAgent'
import { RemindersCard } from './RemindersCard'
import { ASSISTANT_ID } from './useChatAgents'

/** Use the Assistant from Telegram or WhatsApp: it chooses the agent for each message and keeps one thread, which also shows here. */
export function PhonePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { channels, loading, error } = useChannels()
  const mine = channels.filter((c) => c.agent === ASSISTANT_ID)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,34rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">On your phone</SheetTitle>
          <SheetDescription className="text-xs">Message the Assistant on Telegram or WhatsApp. It picks the right agent for each message and remembers the conversation. Send YES to save what it proposes, NO to drop it, and /new to start afresh.</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}
          {loading ? (
            <Spinner label="Loading" />
          ) : (
            <>
              <TelegramCard agentId={ASSISTANT_ID} channel={mine.find((c) => c.kind === 'telegram')} />
              <WhatsAppCard agentId={ASSISTANT_ID} channel={mine.find((c) => c.kind === 'whatsapp')} />
              <RemindersCard />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
