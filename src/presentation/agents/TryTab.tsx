import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ArrowUp, KeyRound, Sparkles, Square, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { AgentStep, Found } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useDriveStatus } from '@/presentation/drive/useDrive'
import { Link } from '@/presentation/routing'
import { FoundCards } from './FoundCards'
import { ModelPicker, useAgentModel } from './ModelPicker'
import { useAgentSummary } from './useAgent'

interface Turn {
  id: number
  question: string
  steps: AgentStep[]
  answer?: string
  found: Found[]
  error?: string
  stopped?: boolean
  pending: boolean
}

/** Ask the agent here, with the model it is set to. Every question is recorded in its history. */
export function TryTab() {
  const { agentId } = useParams()
  const def = useAgentSummary(agentId)!
  // A different agent is a different conversation.
  return <Chat key={def.id} agentId={def.id} suggestions={def.suggestions} />
}

function Chat({ agentId, suggestions }: { agentId: string; suggestions: string[] }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const drive = useDriveStatus()
  const def = useAgentSummary(agentId)!
  const { connected, ready, loading } = useAgentModel(def)

  const [turns, setTurns] = useState<Turn[]>([])
  const [history, setHistory] = useState<unknown[]>([])
  const [text, setText] = useState('')
  const stopped = useRef(new Set<number>())
  const turnIds = useRef(0)
  const end = useRef<HTMLDivElement>(null)
  const busy = turns.some((t) => t.pending)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  const patch = (id: number, p: Partial<Turn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...p } : t)))

  async function ask(question: string) {
    if (!ready || busy || !question.trim()) return
    const id = ++turnIds.current
    setTurns((all) => [...all, { id, question, steps: [], found: [], pending: true }])
    setText('')
    try {
      const reply = await agent.chat(agentId, question, history)
      if (stopped.current.has(id)) return // the person stopped waiting; the turn is already marked
      setHistory(reply.messages)
      patch(id, { answer: reply.answer || 'I found nothing to say about that.', steps: reply.steps, found: reply.found, pending: false })
    } catch (e) {
      if (!stopped.current.has(id)) patch(id, { error: e instanceof Error ? e.message : 'Something went wrong.', pending: false })
    } finally {
      // The run is in the history now, so the overview's numbers have moved.
      void client.invalidateQueries({ queryKey: ['agent', 'stats'] })
      void client.invalidateQueries({ queryKey: ['agent', 'runs'] })
    }
  }

  const stop = () => {
    for (const t of turns) {
      if (t.pending) {
        stopped.current.add(t.id)
        patch(t.id, { stopped: true, pending: false })
      }
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(text)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void ask(text)
    }
  }

  if (loading) return <Spinner label="Loading" />
  if (connected.length === 0) {
    return (
      <Section>
        <EmptyState
          title="Connect a provider first"
          action={
            <Button nativeButton={false} render={<Link to="/agents/providers" />}>
              <KeyRound /> Add a provider
            </Button>
          }
        >
          Agents run on a model from OpenAI, Google Gemini or OpenRouter, using your own key.
        </EmptyState>
      </Section>
    )
  }

  return (
    <div className="grid gap-4 pb-20 lg:pb-8">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/70 p-2">
        <ModelPicker def={def} />
        <div className="ml-auto flex items-center gap-1">
          {turns.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTurns([])
                setHistory([])
              }}
            >
              New chat
            </Button>
          )}
        </div>
      </div>

      {!drive.available && <p className="text-xs text-muted-foreground">Google Drive isn’t connected, so the agent can find cases and the documents already filed under them, but can’t search the Drive.</p>}

      {turns.length === 0 ? (
        <div className="grid gap-3 py-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-5" />
            <span className="font-display text-2xl text-foreground italic">What would you like to ask?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" disabled={!ready} onClick={() => void ask(s)} className="rounded-full border bg-card/70 px-3 py-1.5 text-left text-sm transition-colors hover:border-foreground/30 hover:bg-card disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
          {!ready && <p className="text-xs text-muted-foreground">Choose a model above to begin.</p>}
        </div>
      ) : (
        <div className="grid gap-6">
          {turns.map((t) => (
            <TurnView key={t.id} turn={t} />
          ))}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={submit} className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex items-end gap-2 rounded-2xl border bg-background/95 p-2 shadow-lift backdrop-blur lg:bottom-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={ready ? 'Ask a question…' : 'Choose a model first'}
          disabled={!ready}
          aria-label={`Ask ${def.name}`}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" aria-label="Stop waiting" onClick={stop}>
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || !ready}>
            <ArrowUp />
          </Button>
        )}
      </form>
    </div>
  )
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <div className="grid gap-3">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm text-background">{turn.question}</div>
      {turn.steps.length > 0 && (
        <ul aria-label="What the agent did" className="grid gap-1 text-xs text-muted-foreground">
          {turn.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Wrench className="size-3 shrink-0" />
              <span className="min-w-0 truncate">{s.label}</span>
              <span className={s.error ? 'text-destructive' : ''}>· {s.error ? s.error : `${s.found} found`}</span>
            </li>
          ))}
        </ul>
      )}
      {turn.pending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner size="xs" tone="current" decorative /> Searching and thinking…
        </p>
      )}
      {turn.error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {turn.error}
        </p>
      )}
      {turn.stopped && <p className="text-sm text-muted-foreground">Stopped waiting.</p>}
      {turn.answer && <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-wrap">{turn.answer}</p>}
      <FoundCards found={turn.found} />
    </div>
  )
}
