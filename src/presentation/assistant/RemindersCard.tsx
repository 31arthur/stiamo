import { useState } from 'react'
import type { FormEvent } from 'react'
import { BellRing, Check, Mic, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAgentAction, useReminders } from '@/presentation/agents/useAgent'

/** Reminders for calls you haven't marked done: written on the phone and, if you want, spoken as a Telegram voice message. */
export function RemindersCard() {
  const { data } = useReminders()
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toggle = useAgentAction((a, v: { enabled: boolean; voice: boolean }) => a.setReminders(v.enabled, v.voice))
  const saveKey = useAgentAction((a, k: string) => a.setVoiceKey(k), { success: 'The voice is ready' })
  const removeKey = useAgentAction((a) => a.removeVoiceKey(), { success: 'Voice key removed' })
  const test = useAgentAction((a) => a.testReminder(), { success: (r) => (r.sent ? (r.spoken ? 'Sent. Check Telegram for the voice message.' : 'Sent. It was written only: add a voice key to hear it.') : 'Nothing was sent: connect Telegram or WhatsApp first.') })
  if (!data) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await saveKey.run(key)
      setKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t keep that key.')
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
        <input type="checkbox" checked={data.enabled} disabled={toggle.pending} onChange={(e) => void toggle.run({ enabled: e.target.checked, voice: data.voice })} className="size-4 accent-[var(--foreground)]" />
        Remind me about calls I haven’t done
      </label>

      {data.enabled && (
        <div className="grid gap-3 border-t pt-3">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={data.voice} disabled={toggle.pending} onChange={(e) => void toggle.run({ enabled: data.enabled, voice: e.target.checked })} className="mt-0.5 size-4 accent-[var(--foreground)]" />
            <span>
              Say it aloud on Telegram
              <span className="block text-xs text-muted-foreground">A voice message arrives with the reminder. Telegram doesn’t let a bot ring your phone, so it’s a spoken message you’ll hear as a notification.</span>
            </span>
          </label>

          {data.voice &&
            (data.voiceKey.connected ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
                  <Check className="size-3" /> Deepgram voice ···{data.voiceKey.last4}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void removeKey.run(undefined)} disabled={removeKey.pending}>
                  <Trash2 /> Remove key
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  The voice comes from Deepgram, which gives a new account free credit. Make a key at{' '}
                  <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="underline">
                    console.deepgram.com
                  </a>{' '}
                  and paste it here.
                </p>
                <div className="flex gap-2">
                  <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Deepgram API key" autoComplete="off" spellCheck={false} aria-label="Deepgram API key" aria-invalid={!!error} className="font-mono" />
                  <Button type="submit" size="sm" disabled={!key.trim() || saveKey.pending}>
                    {saveKey.pending ? <Spinner size="xs" tone="current" decorative /> : <Mic />} Keep
                  </Button>
                </div>
                {error && (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                )}
              </form>
            ))}

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
