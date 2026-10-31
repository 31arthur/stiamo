import { useState } from 'react'
import { Gavel, KeyRound, Play, Plus, Scale, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { DecisionAnswer, DecisionKind, DecisionQuestion, DecisionResult } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { useAgentAction, useAgentSettings } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

interface Draft {
  key: number
  name: string
  type: DecisionKind
  instructions: string
  /** choice: option → description rows; score: the levels, lowest first (the key is unused); noul: `true` and `false`. */
  rows: { key: string; value: string }[]
}

const blank = (n: number, type: DecisionKind = 'choice'): Draft => ({
  key: n,
  name: `question_${n}`,
  type,
  instructions: '',
  rows: type === 'noul' ? [{ key: 'true', value: '' }, { key: 'false', value: '' }] : type === 'score' ? [{ key: '', value: '' }, { key: '', value: '' }] : [{ key: '', value: '' }, { key: '', value: '' }],
})

const EXAMPLE_STATE = 'Letter from the NHAI project office, 3 November: the competent authority asks us to produce the wage registers for the Alur site within seven days, failing which it will proceed ex parte at the hearing on 12 November.'
const EXAMPLE: Draft[] = [
  { key: 1, name: 'urgency', type: 'score', instructions: 'How quickly does this letter need a response?', rows: ['Whenever convenient', 'Within a week', 'Within a day'].map((value) => ({ key: '', value })) },
  { key: 2, name: 'needs_documents', type: 'noul', instructions: 'Does the letter ask us to produce documents?', rows: [{ key: 'true', value: 'It asks for registers, records or other documents.' }, { key: 'false', value: 'It asks for nothing to be produced.' }] },
  { key: 3, name: 'next_step', type: 'choice', instructions: 'What should happen next?', rows: [{ key: 'collect_documents', value: 'Collect the documents asked for.' }, { key: 'reply', value: 'Write back, no documents needed.' }, { key: 'brief_counsel', value: 'Brief counsel before the hearing.' }] },
]

function toQuestion(d: Draft): DecisionQuestion {
  if (d.type === 'score') return { type: 'score', instructions: d.instructions, criteria: d.rows.map((r) => r.value) }
  return { type: d.type, instructions: d.instructions, criteria: Object.fromEntries(d.rows.map((r) => [r.key, r.value])) }
}

/** A decision model answers a typed question with probabilities, not prose: pick one, yes or no, or a place on a scale. */
export function DecisionsPage() {
  const { agent } = useServices()
  const { settings, loading } = useAgentSettings()
  const [state, setState] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([blank(1)])
  const [result, setResult] = useState<DecisionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const setDecision = useAgentAction((a, v: { enabled: boolean; modelId: string }) => a.setDecision(v.enabled, v.modelId), { success: 'Saved' })

  if (loading || !settings) return <Spinner label="Loading" />
  const connected = settings.providers.openrouter.connected
  const modelId = model ?? settings.decision.modelId

  const patch = (key: number, p: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...p } : d)))
  const patchRow = (key: number, i: number, p: Partial<{ key: string; value: string }>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) } : d)))

  async function run() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const questions = Object.fromEntries(drafts.map((d) => [d.name.trim() || `question_${d.key}`, toQuestion(d)]))
      setResult(await agent.decide(state, questions, modelId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The decision model couldn’t answer.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Section title="Jev, a decision model" description="Not a chat model: you give it some text and typed questions, and it answers each with probabilities. It runs through your OpenRouter key and charges for what you send, not for what it answers.">
        {!connected ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            Add an OpenRouter key to use it.
            <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/ai/providers" />}>
              <KeyRound /> Providers
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={settings.decision.enabled} onChange={(e) => void setDecision.run({ enabled: e.target.checked, modelId })} className="mt-0.5 size-4 accent-[var(--foreground)]" />
              <span>
                <span className="font-medium">Let the case agent ask it</span>
                <span className="block text-xs text-muted-foreground">Adds a <code className="font-mono">decide</code> tool, so the agent can pick between options or judge urgency with probabilities instead of guessing. It also works in Telegram and WhatsApp.</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Model
              <select value={modelId} onChange={(e) => (setModel(e.target.value), settings.decision.enabled && void setDecision.run({ enabled: true, modelId: e.target.value }))} className={SELECT} aria-label="Decision model">
                {settings.decisionModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">Pick a numbered version to keep answers stable between releases.</span>
            </label>
          </div>
        )}
      </Section>

      <Section
        title="Try it"
        description="Write what is to be decided, then add questions."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setState(EXAMPLE_STATE)
              setDrafts(EXAMPLE)
              setResult(null)
            }}
          >
            Use an example
          </Button>
        }
      >
        <div className="grid gap-4">
          <textarea value={state} onChange={(e) => setState(e.target.value)} rows={5} placeholder="The letter, the message or the note to decide about…" aria-label="Text to decide about" className={AREA} />

          {drafts.map((d) => (
            <fieldset key={d.key} className="grid gap-2 rounded-xl border p-3">
              <legend className="sr-only">Question {d.name}</legend>
              <div className="flex flex-wrap items-center gap-2">
                <Input value={d.name} onChange={(e) => patch(d.key, { name: e.target.value })} aria-label="Question name" className="h-8 w-40 font-mono text-xs" />
                <select
                  value={d.type}
                  onChange={(e) => patch(d.key, { type: e.target.value as DecisionKind, rows: blank(d.key, e.target.value as DecisionKind).rows })}
                  className={SELECT}
                  aria-label="Kind of question"
                >
                  <option value="choice">Pick one of…</option>
                  <option value="noul">Yes or no</option>
                  <option value="score">Place on a scale</option>
                </select>
                {drafts.length > 1 && (
                  <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remove question" onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              <Input value={d.instructions} onChange={(e) => patch(d.key, { instructions: e.target.value })} placeholder={d.type === 'choice' ? 'Which team should handle this?' : d.type === 'noul' ? 'Is this a request for documents?' : 'How urgent is this?'} aria-label="The question" />
              <ul className="grid gap-1.5">
                {d.rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {d.type === 'score' ? (
                      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{i === 0 ? 'Lowest' : i === d.rows.length - 1 ? 'Highest' : `Level ${i + 1}`}</span>
                    ) : d.type === 'noul' ? (
                      <span className="w-14 shrink-0 font-mono text-xs">{r.key}</span>
                    ) : (
                      <Input value={r.key} onChange={(e) => patchRow(d.key, i, { key: e.target.value })} placeholder="option" aria-label="Option" className="h-8 w-36 shrink-0 font-mono text-xs" />
                    )}
                    <Input value={r.value} onChange={(e) => patchRow(d.key, i, { value: e.target.value })} placeholder={d.type === 'noul' ? `When is it ${r.key}?` : 'What this means, in observable terms'} aria-label="Description" className="h-8 text-sm" />
                    {d.type !== 'noul' && d.rows.length > 2 && (
                      <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, rows: x.rows.filter((_, j) => j !== i) } : x)))}>
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {d.type !== 'noul' && (
                <Button variant="ghost" size="xs" className="w-fit" onClick={() => patch(d.key, { rows: [...d.rows, { key: '', value: '' }] })}>
                  <Plus /> {d.type === 'score' ? 'Add a level' : 'Add an option'}
                </Button>
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setDrafts((all) => [...all, blank(Math.max(0, ...all.map((d) => d.key)) + 1)])}>
              <Plus /> Add a question
            </Button>
            <Button onClick={() => void run()} disabled={!connected || running || !state.trim()}>
              {running ? <Spinner size="xs" tone="current" decorative /> : <Play />} Decide
            </Button>
            {!connected && <span className="text-xs text-muted-foreground">Needs an OpenRouter key.</span>}
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}
          {result && <Results result={result} />}
        </div>
      </Section>
    </div>
  )
}

const pct = (n: number) => `${Math.round(n * 100)}%`

function Bar({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 text-xs">
      <span className={strong ? 'truncate font-medium' : 'truncate text-muted-foreground'}>{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full ${strong ? 'bg-foreground' : 'bg-foreground/35'}`} style={{ width: pct(value) }} />
      </span>
      <span className="text-right tabular-nums">{pct(value)}</span>
    </div>
  )
}

function Answer({ name, a }: { name: string; a: DecisionAnswer }) {
  const probs = Object.entries(a.probabilities ?? {})
  return (
    <li className="grid gap-2 rounded-xl border bg-card/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Gavel className="size-3.5 text-muted-foreground" />
        <code className="font-mono text-xs">{name}</code>
        {a.type === 'choice' && <span className="text-sm font-semibold">→ {a.choice}</span>}
        {a.type === 'noul' && <span className="text-sm font-semibold">{(a.noul ?? 0) >= 0.5 ? 'Yes' : 'No'} · {pct(a.noul ?? 0)} likely</span>}
        {a.type === 'score' && <span className="text-sm font-semibold">{(a.score ?? 0).toFixed(2)} on the scale</span>}
        {a.confidence !== undefined && <span className="ml-auto text-[11px] text-muted-foreground">confidence {pct(a.confidence)}</span>}
      </div>
      {a.type === 'noul' && <Bar label="Yes" value={a.noul ?? 0} strong />}
      {a.type !== 'noul' &&
        probs.map(([k, v]) => <Bar key={k} label={a.type === 'score' ? (a.legend?.[k] ?? k) : k} value={v} strong={a.type === 'choice' ? k === a.choice : v === Math.max(...probs.map((p) => p[1]))} />)}
    </li>
  )
}

function Results({ result }: { result: DecisionResult }) {
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2" aria-label="Answers">
        {Object.entries(result.answers).map(([name, a]) => (
          <Answer key={name} name={name} a={a} />
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Scale className="size-3" /> {result.model}
        {result.cost !== undefined && result.cost !== null && ` · $${result.cost.toFixed(5)}`}. Confidence describes how concentrated the answer is, not whether it is safe to act on.
      </p>
    </div>
  )
}
