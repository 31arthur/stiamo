import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Copy, ExternalLink, Link2Off, MessageCircle, RefreshCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { Channel } from '@/domain/ai/AgentApi'
import { Section } from '@/presentation/components/layout'
import { useAgentAction, useAgentSettings, useChannels } from './useAgent'

const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Couldn’t copy. Select it and copy by hand.'))

/** Talk to the agent from your phone: connect a Telegram bot and a WhatsApp number, right from here. */
export function ChannelsPage() {
  const { channels, loading, error } = useChannels()
  const { connected } = useAgentSettings()
  const telegram = channels.find((c) => c.kind === 'telegram')
  const whatsapp = channels.find((c) => c.kind === 'whatsapp')
  return (
    <div className="grid gap-4">
      {connected.length === 0 && <p className="rounded-xl border bg-card/70 px-3.5 py-3 text-sm text-muted-foreground">Add a provider and choose a model first: the channels answer with the same agent, model and prompt as this page.</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner label="Loading" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TelegramCard channel={telegram} />
          <WhatsAppCard channel={whatsapp} />
        </div>
      )}
    </div>
  )
}

function Connected({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
      <Check className="size-3" /> {children}
    </span>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-muted-foreground marker:text-foreground">{children}</ol>
}

function Error({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null
}

// --- Telegram -----------------------------------------------------------------------------------------------

function TelegramCard({ channel }: { channel?: Channel }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const connect = useAgentAction((a, t: string) => a.connectTelegram(t), { success: 'Telegram bot connected' })
  const newCode = useAgentAction((a, id: string) => a.newPairingCode(id))
  const unpair = useAgentAction((a, v: { id: string; chat: string }) => a.unpair(v.id, v.chat), { success: 'Chat unlinked' })
  const test = useAgentAction((a, id: string) => a.sendTest(id), { success: 'Sent. Check Telegram.' })
  const remove = useAgentAction((a, id: string) => a.removeChannel(id), { success: 'Telegram disconnected' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await connect.run(token)
      setToken('')
    } catch (err) {
      setError(err instanceof globalThis.Error ? err.message : 'Couldn’t connect that bot.')
    }
  }

  return (
    <Section title="Telegram" description="Message your own bot to ask about cases and documents." actions={channel ? <Connected>@{channel.username}</Connected> : undefined}>
      {!channel ? (
        <form onSubmit={submit} className="grid gap-3">
          <Steps>
            <li>
              In Telegram, open <b className="text-foreground">@BotFather</b> and send <code className="font-mono">/newbot</code>. Choose a name and a username.
            </li>
            <li>Copy the token it gives you and paste it here.</li>
            <li>Stiamo sets the bot up and gives you a code to link your chat.</li>
          </Steps>
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-DEF…" autoComplete="off" spellCheck={false} aria-label="Bot token" aria-invalid={!!error} className="font-mono" />
          <Error message={error} />
          <Button type="submit" className="w-fit" disabled={!token.trim() || connect.pending}>
            {connect.pending && <Spinner size="xs" tone="current" decorative />} Connect bot
          </Button>
        </form>
      ) : (
        <div className="grid gap-4">
          {channel.pairingCode ? (
            <div className="grid gap-2 rounded-xl bg-muted/50 p-3">
              <p className="text-sm">
                Link your chat: open the bot and press <b>Start</b>, or send it this code.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg border bg-background px-3 py-1.5 font-mono text-lg tracking-widest">{channel.pairingCode}</code>
                <Button variant="outline" size="sm" onClick={() => void copy(`/start ${channel.pairingCode}`, 'Code')}>
                  <Copy /> Copy
                </Button>
                {channel.pairingLink && (
                  <Button size="sm" nativeButton={false} render={<a href={channel.pairingLink} target="_blank" rel="noreferrer" />}>
                    <ExternalLink /> Open in Telegram
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">The code works for 30 minutes and once.</p>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-fit" disabled={newCode.pending} onClick={() => void newCode.run(channel.id)}>
              <RefreshCw /> Link another chat
            </Button>
          )}

          <div>
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Linked chats</h3>
            {channel.paired?.length ? (
              <ul className="grid gap-1.5">
                {channel.paired.map((p) => (
                  <li key={String(p.id)} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                    <MessageCircle className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{p.name || `Chat ${p.id}`}</span>
                    <Button variant="ghost" size="icon-xs" aria-label={`Unlink ${p.name || p.id}`} onClick={() => void unpair.run({ id: channel.id, chat: String(p.id) })}>
                      <Link2Off />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None yet. Only linked chats get answers.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!channel.paired?.length || test.pending} onClick={() => void test.run(channel.id)}>
              <Send /> Send a test message
            </Button>
            <Button variant="ghost" size="sm" disabled={remove.pending} onClick={() => void remove.run(channel.id)}>
              <Trash2 /> Disconnect
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

// --- WhatsApp (Twilio) --------------------------------------------------------------------------------------

const splitNumbers = (text: string) => text.split(/[\n,;]+/).map((n) => n.trim()).filter(Boolean)

function WhatsAppCard({ channel }: { channel?: Channel }) {
  const [form, setForm] = useState({ accountSid: '', authToken: '', sender: '+14155238886', numbers: '' })
  const [numbers, setNumbers] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const connect = useAgentAction((a, f: typeof form) => a.connectWhatsApp({ accountSid: f.accountSid, authToken: f.authToken, sender: f.sender, allowed: splitNumbers(f.numbers) }), { success: 'WhatsApp connected' })
  const allow = useAgentAction((a, v: { id: string; numbers: string }) => a.setAllowed(v.id, splitNumbers(v.numbers)), { success: 'Numbers saved' })
  const test = useAgentAction((a, id: string) => a.sendTest(id), { success: 'Sent. Check WhatsApp.' })
  const remove = useAgentAction((a, id: string) => a.removeChannel(id), { success: 'WhatsApp disconnected' })
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await connect.run(form)
      setForm((f) => ({ ...f, authToken: '' }))
    } catch (err) {
      setError(err instanceof globalThis.Error ? err.message : 'Couldn’t connect WhatsApp.')
    }
  }

  return (
    <Section title="WhatsApp" description="Through Twilio, the official route. Only your own number can use it." actions={channel ? <Connected>{channel.from?.replace('whatsapp:', '') ?? 'Connected'}</Connected> : undefined}>
      {!channel ? (
        <form onSubmit={submit} className="grid gap-3">
          <Steps>
            <li>
              In the Twilio console, open <b className="text-foreground">Messaging → Try it out → Send a WhatsApp message</b>. From your phone, send the <code className="font-mono">join …</code> phrase it shows to the sandbox number.
            </li>
            <li>Copy your Account SID and Auth Token from the console home page.</li>
            <li>Fill this in, press Connect, then paste the webhook address that appears into Twilio.</li>
          </Steps>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={form.accountSid} onChange={(e) => set({ accountSid: e.target.value })} placeholder="Account SID (AC…)" autoComplete="off" spellCheck={false} aria-label="Account SID" className="font-mono" />
            <Input type="password" value={form.authToken} onChange={(e) => set({ authToken: e.target.value })} placeholder="Auth Token" autoComplete="off" spellCheck={false} aria-label="Auth Token" className="font-mono" />
            <Input value={form.sender} onChange={(e) => set({ sender: e.target.value })} placeholder="Send from (+14155238886)" aria-label="Twilio WhatsApp number" className="font-mono" />
            <Input value={form.numbers} onChange={(e) => set({ numbers: e.target.value })} placeholder="Your WhatsApp number (+91…)" aria-label="Your WhatsApp number" className="font-mono" />
          </div>
          <Error message={error} />
          <Button type="submit" className="w-fit" disabled={!form.accountSid.trim() || !form.authToken.trim() || !form.numbers.trim() || connect.pending}>
            {connect.pending && <Spinner size="xs" tone="current" decorative />} Connect WhatsApp
          </Button>
        </form>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2 rounded-xl bg-muted/50 p-3">
            <p className="text-sm">
              Last step, in Twilio: <b>Messaging → Settings → WhatsApp sandbox settings</b>. Paste this into <i>When a message comes in</i> (method POST) and save.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border bg-background px-2.5 py-1.5 font-mono text-xs" title={channel.webhookUrl ?? ''}>
                {channel.webhookUrl}
              </code>
              <Button variant="outline" size="sm" onClick={() => void copy(channel.webhookUrl ?? '', 'Webhook address')}>
                <Copy /> Copy
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Twilio’s sandbox forgets you after 72 hours: send the join phrase again if replies stop.</p>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="wa-allowed" className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              Numbers that may use it
            </label>
            <div className="flex gap-2">
              <Input id="wa-allowed" value={numbers ?? channel.allowed?.map((n) => n.replace('whatsapp:', '')).join(', ') ?? ''} onChange={(e) => setNumbers(e.target.value)} className="font-mono text-sm" />
              <Button
                variant="outline"
                disabled={numbers === null || allow.pending}
                onClick={async () => {
                  await allow.run({ id: channel.id, numbers: numbers! })
                  setNumbers(null)
                }}
              >
                Save
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Anyone else is ignored without a reply.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={test.pending} onClick={() => void test.run(channel.id)}>
              <Send /> Send a test message
            </Button>
            <Button variant="ghost" size="sm" disabled={remove.pending} onClick={() => void remove.run(channel.id)}>
              <Trash2 /> Disconnect
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}
