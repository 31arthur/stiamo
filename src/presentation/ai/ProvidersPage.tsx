import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Eye, EyeOff, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { createLlmClient } from '@/data/ai/store'
import { PROVIDER_IDS, PROVIDERS } from '@/domain/ai/types'
import type { ProviderId } from '@/domain/ai/types'
import { Section } from '@/presentation/components/layout'
import { useAiSettings, useModels } from './useAi'

/** Add the providers the agent can use. A key is checked against the provider before it is kept. */
export function ProvidersPage() {
  const { settings, setKey } = useAiSettings()
  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 rounded-xl border bg-card/70 px-3.5 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>
          Keys stay in this browser and go only to the provider they belong to. They are removed when you sign out. When you ask the agent something, the matching cases and document names are sent to the provider you chose, so pick one you are happy to share them with.
        </span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PROVIDER_IDS.map((id) => (
          <ProviderCard key={id} id={id} apiKey={settings.keys[id]} onSave={(k) => setKey(id, k)} onRemove={() => setKey(id, null)} />
        ))}
      </div>
    </div>
  )
}

function ProviderCard({ id, apiKey, onSave, onRemove }: { id: ProviderId; apiKey?: string; onSave: (key: string) => void; onRemove: () => void }) {
  const meta = PROVIDERS[id]
  const client = useQueryClient()
  const [draft, setDraft] = useState('')
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const models = useModels(id, apiKey)

  async function save(e: FormEvent) {
    e.preventDefault()
    const key = draft.trim()
    if (!key) return
    setChecking(true)
    setError(null)
    try {
      // A key that can't list models is no use, so say so now rather than on the first question.
      const list = await createLlmClient(id, key).listModels()
      if (list.length === 0) throw new Error('That key works, but it has no models this agent can use.')
      client.setQueryData(['ai', 'models', id, key.slice(-6)], list)
      onSave(key)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t check that key.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Section title={meta.label} description={meta.tagline} actions={apiKey ? <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success"><Check className="size-3" /> Connected</span> : undefined}>
      {apiKey ? (
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
          <p className="font-mono text-xs text-muted-foreground">Key ending …{apiKey.slice(-4)}</p>
          <Button variant="outline" size="sm" className="w-fit" onClick={onRemove}>
            <Trash2 /> Remove key
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="grid gap-3">
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={meta.keyHint}
              autoComplete="off"
              spellCheck={false}
              aria-label={`${meta.label} API key`}
              aria-invalid={!!error}
              className="pr-9 font-mono"
            />
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
            <Button type="submit" size="sm" disabled={!draft.trim() || checking}>
              {checking && <Spinner size="xs" tone="current" decorative />} Check and save
            </Button>
          </div>
        </form>
      )}
    </Section>
  )
}
