import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ExternalLink, Eye, EyeOff, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PROVIDER_IDS, PROVIDERS } from '@/domain/ai/types'
import type { ProviderId } from '@/domain/ai/types'
import { Section } from '@/presentation/components/layout'
import { useAgentAction, useAgentSettings, useModels } from './useAgent'

/** Add the providers the agent can use. A key is checked against the provider before the server keeps it. */
export function ProvidersPage() {
  const { settings, loading, error } = useAgentSettings()
  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 rounded-xl border bg-card/70 px-3.5 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>
          Keys are kept encrypted on your Stiamo server, never in the browser, and are never sent back to it. When you ask the agent something, the question and the matching cases and document names go to the provider you chose, so pick one you are happy to share them with.
        </span>
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner label="Loading" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROVIDER_IDS.map((id) => (
            <ProviderCard key={id} id={id} connected={!!settings?.providers[id]?.connected} last4={settings?.providers[id]?.last4} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderCard({ id, connected, last4 }: { id: ProviderId; connected: boolean; last4?: string }) {
  const meta = PROVIDERS[id]
  const [draft, setDraft] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const models = useModels(id, connected)
  const save = useAgentAction((a, key: string) => a.putKey(id, key), { success: `${meta.label} connected` })
  const remove = useAgentAction((a) => a.removeKey(id), { success: 'Key removed' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setError(null)
    try {
      await save.run(draft)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t check that key.')
    }
  }

  return (
    <Section
      title={meta.label}
      description={meta.tagline}
      actions={
        connected ? (
          <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
            <Check className="size-3" /> Connected
          </span>
        ) : undefined
      }
    >
      {connected ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            {models.isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="xs" tone="current" decorative /> Loading models…
              </span>
            ) : models.error ? (
              <span className="text-destructive">{models.error instanceof Error ? models.error.message : 'Couldn’t load the models.'}</span>
            ) : (
              <>
                {models.data?.length ?? 0} models available
                {!!models.data?.some((m) => m.thinking.length) && <>, {models.data.filter((m) => m.thinking.length).length} that can think</>}.
              </>
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">Key ending …{last4}</p>
          <Button variant="outline" size="sm" className="w-fit" disabled={remove.pending} onClick={() => void remove.run(undefined)}>
            <Trash2 /> Remove key
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={meta.keyHint} autoComplete="off" spellCheck={false} aria-label={`${meta.label} API key`} aria-invalid={!!error} className="pr-9 font-mono" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              Get a key <ExternalLink className="size-3" />
            </a>
            <Button type="submit" size="sm" disabled={!draft.trim() || save.pending}>
              {save.pending && <Spinner size="xs" tone="current" decorative />} Check and save
            </Button>
          </div>
        </form>
      )}
    </Section>
  )
}
