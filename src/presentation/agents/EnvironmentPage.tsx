import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, CircleAlert, ExternalLink, KeyRound, Lock, PlugZap, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { EnvVariable } from '@/domain/ai/AgentApi'
import { PageHeader } from '@/presentation/components/layout'
import { useAgentAction, useEnvironment } from './useAgent'

/** Secrets the services use, like a voice key. Once saved a value is sealed on the server and never shown again: it can be replaced, removed or tested. */
export function EnvironmentPage() {
  const { data, isLoading, error } = useEnvironment()
  return (
    <>
      <PageHeader eyebrow="Developer" title="Environment" description="Keys and secrets Stiamo’s services use. They’re encrypted on your server the moment you save them, and they can’t be viewed again: only replaced, removed or tested." />
      <p className="flex items-start gap-2 rounded-xl border bg-card/70 px-3.5 py-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-success" />
        <span>Nothing here is ever sent back to the browser, not even the last few characters. If you lose a key, make a new one at its service and replace it.</span>
      </p>
      {error instanceof Error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error.message}
        </p>
      )}
      {isLoading ? (
        <Spinner label="Loading" />
      ) : (
        <ul className="grid gap-4">
          {(data ?? []).map((v) => (
            <li key={v.id}>
              <Variable v={v} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

type Result = { ok: boolean; message: string } | null

function Variable({ v }: { v: EnvVariable }) {
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const save = useAgentAction((a, val: string) => a.setEnvironment(v.id, val))
  const remove = useAgentAction((a) => a.removeEnvironment(v.id), { success: 'Removed' })
  const test = useAgentAction((a) => a.testEnvironment(v.id))

  async function runTest() {
    setResult(null)
    try {
      setResult(await test.run(undefined))
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'The test failed.' })
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setResult(null)
    try {
      await save.run(value)
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Couldn’t save that.' })
      return
    }
    setValue('')
    setEditing(false)
    await runTest() // saved, so check at once that the service takes it
  }

  const showForm = !v.set || editing
  return (
    <section className="grid gap-3 rounded-2xl border bg-card/70 p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-sm font-semibold">{v.name}</h2>
            {v.set ? (
              <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
                <Check className="size-3" /> Set
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Not set</span>
            )}
          </div>
          <p className="text-sm">{v.label}</p>
          <p className="text-xs text-muted-foreground">
            {v.description}{' '}
            <a href={v.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
              Get one <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
      </header>

      {showForm ? (
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={v.set ? 'Paste the new value' : 'Paste the value'} autoComplete="off" spellCheck={false} aria-label={`${v.name} value`} className="min-w-0 flex-1 font-mono" />
          <Button type="submit" size="sm" disabled={!value.trim() || save.pending}>
            {save.pending ? <Spinner size="xs" tone="current" decorative /> : <Lock />} Save
          </Button>
          {v.set && (
            <Button type="button" variant="ghost" size="sm" onClick={() => (setEditing(false), setValue(''))}>
              Cancel
            </Button>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={test.pending}>
            {test.pending ? <Spinner size="xs" tone="current" decorative /> : <PlugZap />} Test connection
          </Button>
          <Button variant="ghost" size="sm" onClick={() => (setEditing(true), setResult(null))}>
            <RefreshCw /> Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void remove.run(undefined)} disabled={remove.pending}>
            <Trash2 /> Remove
          </Button>
        </div>
      )}

      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'flex items-center gap-1.5 text-xs text-success' : 'flex items-start gap-1.5 text-xs text-destructive'}>
          {result.ok ? <Check className="size-3.5" /> : <CircleAlert className="mt-px size-3.5 shrink-0" />} {result.message}
        </p>
      )}
    </section>
  )
}
