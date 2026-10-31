import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ArrowUp, Brain, ChevronDown, KeyRound, Sparkles, Square, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Spinner } from '@/components/ui/spinner'
import type { AgentStep, AgentSummary, Found } from '@/domain/ai/AgentApi'
import { PROVIDERS, THINKING_LABELS } from '@/domain/ai/types'
import type { ModelInfo, ProviderId, ThinkingLevel } from '@/domain/ai/types'
import { useServices } from '@/presentation/app/services'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useDriveStatus } from '@/presentation/drive/useDrive'
import { Link } from '@/presentation/routing'
import { FoundCards } from './FoundCards'
import { AgentPicker } from './AgentPicker'
import { useAgentAction, useAgentSettings, useCurrentAgent, useModels } from './useAgent'

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

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** The default level for a model: a middling one where there is a choice, otherwise whatever it allows. */
const defaultThinking = (m?: ModelInfo): ThinkingLevel => (m?.thinking.includes('medium') ? 'medium' : (m?.thinking[0] ?? 'off'))

/** Ask an agent. Which one is chosen here; each has its own model and prompt, and the server decides what exists. */
export function AgentPage() {
  const { loading } = useAgentSettings()
  const { agents, agent, choose } = useCurrentAgent()
  if (loading || !agent) return <Spinner label="Loading" />
  // A different agent is a different conversation, so the chat starts again.
  return <AgentChat key={agent.id} def={agent} agents={agents} onChoose={choose} />
}

function AgentChat({ def, agents, onChoose }: { def: AgentSummary; agents: AgentSummary[]; onChoose: (id: string) => void }) {
  const { agent } = useServices()
  const drive = useDriveStatus()
  const { connected, loading } = useAgentSettings()
  const setSelection = useAgentAction((a, s: { providerId: ProviderId; modelId: string; thinking: ThinkingLevel }) => a.setSelection(def.id, s))

  const selection = def.selection
  const provider: ProviderId | undefined = selection && connected.includes(selection.providerId) ? selection.providerId : connected[0]
  const models = useModels(provider, !!provider)
  const model = models.data?.find((m) => m.id === selection?.modelId)
  const thinking: ThinkingLevel = !model ? (selection?.thinking ?? 'off') : model.thinking.includes(selection!.thinking) ? selection!.thinking : defaultThinking(model)

  const [turns, setTurns] = useState<Turn[]>([])
  const [history, setHistory] = useState<unknown[]>([])
  const [text, setText] = useState('')
  const [picking, setPicking] = useState(false)
  const stopped = useRef(new Set<number>())
  const turnIds = useRef(0)
  const end = useRef<HTMLDivElement>(null)
  const busy = turns.some((t) => t.pending)
  const ready = !!selection?.modelId && selection.providerId === provider

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
      const reply = await agent.chat(def.id, question, history)
      if (stopped.current.has(id)) return // the person stopped waiting; the turn is already marked
      setHistory(reply.messages)
      patch(id, { answer: reply.answer || 'I found nothing to say about that.', steps: reply.steps, found: reply.found, pending: false })
    } catch (e) {
      if (!stopped.current.has(id)) patch(id, { error: e instanceof Error ? e.message : 'Something went wrong.', pending: false })
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

  const pickProvider = (id: ProviderId) => void setSelection.run({ providerId: id, modelId: '', thinking: 'off' })
  const pickModel = (m: ModelInfo) => {
    void setSelection.run({ providerId: provider!, modelId: m.id, thinking: defaultThinking(m) })
    setPicking(false)
  }
  const clear = () => {
    setTurns([])
    setHistory([])
  }

  if (loading) return <Spinner label="Loading" />
  if (connected.length === 0) {
    return (
      <Section>
        <EmptyState
          title="Add a provider to start"
          action={
            <Button nativeButton={false} render={<Link to="/ai/providers" />}>
              <KeyRound /> Add a provider
            </Button>
          }
        >
          The agent runs on a model from OpenAI, Google Gemini or OpenRouter, using your own key. Add one and it can search your cases and documents.
        </EmptyState>
      </Section>
    )
  }

  return (
    <div className="grid gap-4 pb-20 lg:pb-8">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/70 p-2">
        <AgentPicker agents={agents} value={def.id} onChange={onChoose} />
        <select aria-label="Provider" value={provider} onChange={(e) => pickProvider(e.target.value as ProviderId)} className={SELECT}>
          {connected.map((id) => (
            <option key={id} value={id}>
              {PROVIDERS[id].label}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="max-w-full min-w-40 justify-between" onClick={() => setPicking(true)} disabled={models.isLoading || !!models.error}>
          {models.isLoading ? (
            <span className="flex items-center gap-2">
              <Spinner size="xs" tone="current" decorative /> Loading models…
            </span>
          ) : (
            <>
              <span className="truncate">{model?.name ?? 'Choose a model'}</span>
              <ChevronDown />
            </>
          )}
        </Button>
        {model && model.thinking.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Brain className="size-3.5" /> Thinking
            <select aria-label="Thinking" value={thinking} onChange={(e) => void setSelection.run({ providerId: provider!, modelId: model.id, thinking: e.target.value as ThinkingLevel })} className={SELECT}>
              {model.thinking.map((l) => (
                <option key={l} value={l}>
                  {THINKING_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
        )}
        {models.error && (
          <span role="alert" className="text-xs text-destructive">
            {models.error instanceof Error ? models.error.message : 'Couldn’t load the models.'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/ai/prompt" />}>
            Prompt
          </Button>
          {turns.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>
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
            <span className="font-display text-2xl text-foreground italic">{def.name}</span>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">
            {def.description}
            {def.selectionInherited && ' Using the model you chose last; pick one above to give this agent its own.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {def.suggestions.map((s) => (
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
          placeholder={ready ? 'Ask about a case, a party, a court number, a document…' : 'Choose a model first'}
          disabled={!ready}
          aria-label="Ask the case agent"
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

      <CommandDialog open={picking} onOpenChange={setPicking} title="Choose a model" description={`Models available from ${provider ? PROVIDERS[provider].label : 'the provider'}`} className="sm:max-w-lg">
        <Command>
          <CommandInput placeholder={`Search ${models.data?.length ?? 0} models…`} />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No model matches.</CommandEmpty>
            {models.data?.map((m) => (
              <CommandItem key={m.id} value={`${m.name} ${m.id}`} onSelect={() => pickModel(m)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.name}</span>
                  {m.name !== m.id && <span className="block truncate text-[11px] text-muted-foreground">{m.id}</span>}
                </span>
                {m.thinking.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">
                    <Brain className="size-3" /> thinks
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
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
