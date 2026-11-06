import { useState } from 'react'
import { BellRing, Check, PhoneCall, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { ReminderSettings } from '@/domain/ai/AgentApi'
import { Link } from '@/presentation/routing'
import { useAgentAction, useReminders } from '@/presentation/agents/useAgent'

/** Reminders for calls you haven't marked done: written on the phone and, if you want, spoken as a Telegram voice message. */
export function RemindersCard() {
  const { data } = useReminders()
  const [user, setUser] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const toggle = useAgentAction((a, v: Omit<ReminderSettings, 'voiceKey' | 'timezone'>) => a.setReminders(v))
  const test = useAgentAction((a) => a.testReminder(), { success: (r) => (r.rang ? 'Ringing you on Telegram now.' : r.sent ? (r.spoken ? 'Sent. Check Telegram for the voice message.' : 'Sent. It was written only: add a voice key or switch on the call to hear it.') : 'Nothing was sent: connect Telegram or WhatsApp first.') })
  if (!data) return null

  const current = { enabled: data.enabled, voice: data.voice, call: data.call, callUser: data.callUser, callVoice: data.callVoice }

  async function saveCall(call: boolean, callUser: string) {
    setCallError(null)
    try {
      await toggle.run({ ...current, call, callUser })
      setUser(null)
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Couldn’t save that.')
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <BellRing className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Call reminders</h3>
          <p className="text-xs text-muted-foreground">
            When calls on your planner aren’t marked done, you’re reminded 10 minutes after the last one ends, then 1 hour, 30 and 10 minutes later. Never while you’re in a hearing, a meeting or an event, and only between 9 am and 9 pm.
          </p>
        </div>
      </header>

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" checked={data.enabled} disabled={toggle.pending} onChange={(e) => void toggle.run({ ...current, enabled: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
        Remind me about calls I haven’t done
      </label>

      {data.enabled && (
        <div className="grid gap-3 border-t pt-3">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={data.voice} disabled={toggle.pending} onChange={(e) => void toggle.run({ ...current, voice: e.target.checked })} className="mt-0.5 size-4 accent-[var(--foreground)]" />
            <span>
              Say it aloud on Telegram
              <span className="block text-xs text-muted-foreground">A voice message arrives with the reminder. Telegram doesn’t let a bot ring your phone, so it’s a spoken message you’ll hear as a notification.</span>
            </span>
          </label>

          {data.voice && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {data.voiceKey.connected ? (
                <>
                  <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
                    <Check className="size-3" /> Voice ready
                  </span>
                  The Deepgram key is set.
                </>
              ) : (
                <span>
                  The voice needs a Deepgram key. Add <span className="font-mono">DEEPGRAM_API_KEY</span> in{' '}
                  <Link to="/agents/environment" className="underline">
                    Developer → Environment
                  </Link>
                  .
                </span>
              )}
            </p>
          )}

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={data.call}
              disabled={toggle.pending}
              onChange={(e) => (e.target.checked ? setUser(data.callUser) : void saveCall(false, data.callUser))}
              className="mt-0.5 size-4 accent-[var(--foreground)]"
            />
            <span>
              Ring me on Telegram
              <span className="block text-xs text-muted-foreground">A real Telegram call that reads the reminder aloud when you answer. It comes through CallMeBot, a free third-party service.</span>
            </span>
          </label>

          {(data.call || user !== null) && (
            <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
              <ol className="grid list-decimal gap-1 pl-5 text-xs text-muted-foreground marker:text-foreground">
                <li>
                  In Telegram, send <span className="font-mono">/start</span> to{' '}
                  <a href="https://t.me/CallMeBot_txtbot" target="_blank" rel="noopener noreferrer" className="underline">
                    @CallMeBot_txtbot
                  </a>{' '}
                  so it may call you.
                </li>
                <li>In Telegram’s Privacy and Security → Calls, allow calls from it (or from everyone).</li>
                <li>Give your username or number below, then send a test.</li>
              </ol>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveCall(true, user ?? data.callUser)
                }}
                className="flex gap-2"
              >
                <Input value={user ?? data.callUser} onChange={(e) => setUser(e.target.value)} placeholder="@yourname or +919876543210" autoComplete="off" spellCheck={false} aria-label="Telegram username or number to ring" aria-invalid={!!callError} className="font-mono" />
                <Button type="submit" size="sm" disabled={toggle.pending || !(user ?? data.callUser).trim() || (data.call && user === data.callUser)}>
                  {toggle.pending ? <Spinner size="xs" tone="current" decorative /> : <PhoneCall />} {data.call ? 'Save' : 'Turn on'}
                </Button>
              </form>
              {callError && (
                <p role="alert" className="text-xs text-destructive">
                  {callError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">It reads up to 256 characters, so a call names as many pending calls as fit; the written message lists them all.</p>
            </div>
          )}

          <div>
            <Button variant="outline" size="sm" onClick={() => void test.run(undefined)} disabled={test.pending}>
              {test.pending ? <Spinner size="xs" tone="current" decorative /> : <Send />} Send a test
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
