import { useEffect, useMemo, useState } from 'react'
import { BellRing, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { Theme } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { PageHeader, Section } from '@/presentation/components/layout'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'
import { useAgentAction, useThemes } from './useAgent'

const BLANK: Theme = {
  id: '',
  name: '',
  emoji: '🏛️',
  accent: '#1f4e79',
  default: false,
  match: { domains: [], addresses: [], phrases: [] },
  tone: '',
  language: 'English',
  greeting: 'Dear {name},',
  signoff: 'Yours sincerely,',
  signature: '',
  letterhead: { title: '', tagline: '', footer: '' },
}

const words = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean)
const join = (a: string[]) => a.join(', ')

/** The organisations you write to, and how a reply to each should sound and look. Used when an agent drafts a reply to an urgent email. */
export function DesignPage() {
  const { data, isLoading } = useThemes()
  const themes = useMemo(() => data ?? [], [data])
  const [selected, setSelected] = useState<string | null>(null)
  const save = useAgentAction((a, list: Theme[]) => a.setThemes(list))
  const sample = useAgentAction((a) => a.sendSampleAlert(), { success: (r) => (r.sent ? 'Sent. Check Telegram.' : 'Nothing was sent: connect Telegram and pair your chat first.') })

  const current = selected === 'new' ? BLANK : themes.find((t) => t.id === selected) ?? null

  async function put(next: Theme[], pick?: (saved: Theme[]) => string | null, message?: string) {
    const saved = await save.run(next)
    if (pick) setSelected(pick(saved))
    if (message) toast.success(message)
  }

  return (
    <>
      <PageHeader
        eyebrow="Developer"
        title="Design"
        description="Themes for the organisations you write to. When an agent drafts a reply to an urgent email, the theme for that sender sets how it sounds (tone, language), how it opens and closes, and how it looks (letterhead, colour, signature)."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void sample.run(undefined)} disabled={sample.pending}>
              {sample.pending ? <Spinner size="xs" tone="current" decorative /> : <BellRing />} Send a sample alert
            </Button>
            <Button size="sm" onClick={() => setSelected('new')}>
              <Plus /> New theme
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Spinner label="Loading" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <ul className="grid content-start gap-2" aria-label="Themes">
            {themes.length === 0 && selected !== 'new' && <li className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No themes yet. Add one for an organisation you write to.</li>}
            {themes.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelected(t.id)} className={cn('flex w-full items-center gap-3 rounded-xl border bg-card/70 px-3 py-2.5 text-left transition-colors hover:bg-muted/50', selected === t.id && 'border-foreground/40 bg-muted/60')}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg text-lg" style={{ background: `${t.accent}22`, color: t.accent }}>
                    {t.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.default ? 'Default · ' : ''}{t.match.domains[0] ?? t.match.addresses[0] ?? t.match.phrases[0] ?? 'No match rules'}</span>
                  </span>
                </button>
              </li>
            ))}
            {selected === 'new' && (
              <li className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">A new theme…</li>
            )}
          </ul>

          {current ? (
            <Editor key={selected ?? ''} theme={current} saving={save.pending} onSave={(t) => void put(selected === 'new' ? [...themes, t] : themes.map((x) => (x.id === t.id ? t : x)), (saved) => saved.find((s) => s.name === t.name)?.id ?? null, 'Theme saved')} onDelete={selected === 'new' ? undefined : () => void put(themes.filter((x) => x.id !== current.id), () => null, 'Theme removed')} />
          ) : (
            <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Pick a theme to edit it, or add a new one.</p>
          )}
        </div>
      )}
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
      {hint && <span className="font-normal">{hint}</span>}
    </label>
  )
}

function Editor({ theme, saving, onSave, onDelete }: { theme: Theme; saving: boolean; onSave: (t: Theme) => void; onDelete?: () => void }) {
  const { agent } = useServices()
  const [t, setT] = useState<Theme>(theme)
  const [domains, setDomains] = useState(join(theme.match.domains))
  const [addresses, setAddresses] = useState(join(theme.match.addresses))
  const [phrases, setPhrases] = useState(join(theme.match.phrases))
  const [html, setHtml] = useState('')
  const [sure, setSure] = useState(false)
  const set = (patch: Partial<Theme>) => setT((p) => ({ ...p, ...patch }))
  const setHead = (patch: Partial<Theme['letterhead']>) => setT((p) => ({ ...p, letterhead: { ...p.letterhead, ...patch } }))
  const built: Theme = { ...t, match: { domains: words(domains), addresses: words(addresses), phrases: words(phrases) } }

  // What a reply looks like, from the server (the same code that sends it), a moment after the last change.
  useEffect(() => {
    const id = setTimeout(() => {
      agent
        .previewTheme({ ...built, name: built.name || 'Preview' })
        .then((r) => setHtml(r.html))
        .catch(() => undefined)
    }, 450)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(built)])

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid gap-4">
        <Section title="Who it is for" description="A mail gets the theme whose address matches, then whose domain, then whose words appear in it, then your default.">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_6rem]">
              <Field label="Name">
                <Input value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="Labour Department" maxLength={60} />
              </Field>
              <Field label="Emoji">
                <Input value={t.emoji} onChange={(e) => set({ emoji: e.target.value })} maxLength={8} className="text-center text-lg" />
              </Field>
              <Field label="Colour">
                <div className="flex items-center gap-1.5">
                  <input type="color" value={t.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Accent colour" className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" />
                </div>
              </Field>
            </div>
            <Field label="Their domains" hint="Separate with commas, like labour.gov.in, nic.in">
              <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="labour.gov.in" className="font-mono text-xs" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Or exact addresses">
                <Input value={addresses} onChange={(e) => setAddresses(e.target.value)} placeholder="registrar@example.org" className="font-mono text-xs" />
              </Field>
              <Field label="Or words in the mail">
                <Input value={phrases} onChange={(e) => setPhrases(e.target.value)} placeholder="conciliation, tender" />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={t.default} onChange={(e) => set({ default: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
              Use it when no other theme matches
            </label>
          </div>
        </Section>

        <Section title="How replies sound" description="Told to the model that writes the draft. It never invents facts: where something is missing it leaves a [placeholder] for you.">
          <div className="grid gap-3">
            <Field label="Tone">
              <Textarea value={t.tone} onChange={(e) => set({ tone: e.target.value })} rows={3} maxLength={1000} placeholder="Formal and deferential. Address the officer as Sir or Madam. Short, numbered points." />
            </Field>
            <Field label="Language">
              <Input value={t.language} onChange={(e) => set({ language: e.target.value })} maxLength={40} className="max-w-60" />
            </Field>
          </div>
        </Section>

        <Section title="How replies open and close" description="Added around what the model writes. {name} becomes the person’s first name, or Sir/Madam when it isn’t known.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Greeting">
              <Input value={t.greeting} onChange={(e) => set({ greeting: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Sign-off">
              <Input value={t.signoff} onChange={(e) => set({ signoff: e.target.value })} maxLength={80} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Signature">
                <Textarea value={t.signature} onChange={(e) => set({ signature: e.target.value })} rows={3} maxLength={600} placeholder={'Arjun\nS&B Consultants'} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Letterhead" description="The top and bottom of the email.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organisation name">
              <Input value={t.letterhead.title} onChange={(e) => setHead({ title: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Tagline">
              <Input value={t.letterhead.tagline} onChange={(e) => setHead({ tagline: e.target.value })} maxLength={160} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Footer">
                <Textarea value={t.letterhead.footer} onChange={(e) => setHead({ footer: e.target.value })} rows={2} maxLength={400} placeholder="Privileged and confidential. If you are not the intended recipient, please delete this email." />
              </Field>
            </div>
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onSave(built)} disabled={saving || !built.name.trim()}>
            {saving ? <Spinner size="xs" tone="current" decorative /> : <Save />} Save theme
          </Button>
          {onDelete &&
            (sure ? (
              <>
                <Button variant="destructive" size="sm" onClick={onDelete} disabled={saving}>
                  <Trash2 /> Yes, remove it
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSure(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setSure(true)}>
                <Trash2 /> Remove
              </Button>
            ))}
        </div>
      </div>

      <aside className="grid content-start gap-4 xl:sticky xl:top-4">
        <Section title="The alert on Telegram" description="Loud on purpose, so it can’t be mistaken for a quiet message.">
          <div className="grid gap-1.5 rounded-xl bg-[#17212b] p-3.5 text-[13px] leading-relaxed text-[#e8eef4]">
            <b>🚨🚨 URGENT · S&amp;B 🚨🚨</b>
            <span className="text-[#6d7f90]">━━━━━━━━━━━━━━</span>
            <span>
              {built.emoji} {built.name || 'Theme name'}
            </span>
            <b className="mt-1">✉️ Registration closes tomorrow</b>
            <span>👤 Registrar</span>
            <i className="text-[#b8c7d4]">📝 Confirm attendance and send the delegate details by Friday.</i>
            <span>
              <b>⚡ Do:</b> Confirm and send details
            </span>
            <span className="mt-2 grid gap-1">
              {['🔗 Open the email in Stiamo', '1️⃣ Confirm attendance', '2️⃣ Ask for more time', '✍️ Write my own   ·   👌 Handled'].map((b) => (
                <span key={b} className="rounded-md bg-[#2b5278]/70 px-2 py-1 text-center text-xs">
                  {b}
                </span>
              ))}
            </span>
          </div>
        </Section>
        <Section title="A reply in this theme" description="The email as it would be sent.">
          {html ? <iframe title="Reply preview" srcDoc={html} sandbox="" className="h-[26rem] w-full rounded-lg border bg-white" /> : <Spinner label="Preparing the preview" />}
        </Section>
      </aside>
    </div>
  )
}
