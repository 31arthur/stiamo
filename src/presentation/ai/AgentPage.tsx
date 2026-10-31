import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ArrowUp, Brain, ChevronDown, KeyRound, Sparkles, Square, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Spinner } from '@/components/ui/spinner'
import { createLlmClient } from '@/data/ai/store'
import { runAgent } from '@/domain/ai/agent'
import type { AgentStep, Found } from '@/domain/ai/agent'
import { buildCaseTools, caseAgentPrompt } from '@/domain/ai/caseTools'
import { PROVIDERS, THINKING_LABELS } from '@/domain/ai/types'
import type { AiSelection, Message, ModelInfo, ProviderId, ThinkingLevel } from '@/domain/ai/types'
import { useServices } from '@/presentation/app/services'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { useDriveStatus } from '@/presentation/drive/useDrive'
import { Link } from '@/presentation/routing'
import { FoundCards } from './FoundCards'
import { useAiSettings, useModels } from './useAi'

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

const SUGGESTIONS = ['Which cases have a hearing in the next two weeks?', 'Find the open cases against NHAI', 'What documents do we have for the Alur case?', 'Which active cases have nothing filed under them?']

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** The default level for a model: a middling one where there is a choice, otherwise whatever it allows. */
const defaultThinking = (m?: ModelInfo): ThinkingLevel => (m?.thinking.includes('medium') ? 'medium' : (m?.thinking[0] ?? 'off'))

/** Ask about cases; the agent searches them and the Drive, and shows what it found. */
export function AgentPage() {
  const services = useServices()
  const today = useToday()
  const drive = useDriveStatus()
  const { settings, connected, setSelection } = useAiSettings()
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: attachments } = useEntities('attachment')

  const selection: AiSelection | undefined = settings.selection && settings.keys[settings.selection.providerId] ? settings.selection : undefined
  const provider: ProviderId | undefined = selection?.providerId ?? connected[0]
  const apiKey = provider ? settings.keys[provider] : undefined
  const models = useModels(provider, apiKey)
  const model = models.data?.find((m) => m.id === selection?.modelId)
  // Until the model list is known, what was chosen stands.
  const thinking: ThinkingLevel = !model ? (selection?.thinking ?? 'off') : model.thinking.includes(selection!.thinking) ? selection!.thinking : defaultThinking(model)

  const [turns, setTurns] = useState<Turn[]>([])
  const [history, setHistory] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [picking, setPicking] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const turnIds = useRef(0)
  const end = useRef<HTMLDivElement>(null)
  const busy = turns.some((t) => t.pending)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  const tools = useMemo(() => buildCaseTools({ cases, hearings, attachments, drive: services.drive, driveAvailable: drive.available, today }), [cases, hearings, attachments, services.drive, drive.available, today])

  const patch = (id: number, p: Partial<Turn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...p } : t)))

  async function ask(question: string) {
    if (!provider || !apiKey || !selection?.modelId || busy || !question.trim()) return
    const id = ++turnIds.current
    const controller = new AbortController()
    abort.current = controller
    setTurns((all) => [...all, { id, question, steps: [], found: [], pending: true }])
    setText('')
    try {
      const run = await runAgent({
        client: createLlmClient(provider, apiKey),
        model: selection.modelId,
        thinking,
        system: caseAgentPrompt(today),
        tools,
        history,
        question,
        signal: controller.signal,
        onStep: (step) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, steps: [...t.steps, step], found: [...t.found, ...step.found] } : t))),
      })
      setHistory(run.messages)
      patch(id, { answer: run.answer || 'I found nothing to say about that.', found: run.found, pending: false })
    } catch (e) {
      if (controller.signal.aborted) patch(id, { stopped: true, pending: false })
      else patch(id, { error: e instanceof Error ? e.message : 'Something went wrong.', pending: false })
    } finally {
      abort.current = null
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

  const pickProvider = (id: ProviderId) => setSelection({ providerId: id, modelId: '', thinking: 'off' })
  const pickModel = (m: ModelInfo) => {
    setSelection({ providerId: provider!, modelId: m.id, thinking: defaultThinking(m) })
    setPicking(false)
  }
  const clear = () => {
    abort.current?.abort()
    setTurns([])
    setHistory([])
  }

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
            <select aria-label="Thinking" value={thinking} onChange={(e) => setSelection({ ...selection!, thinking: e.target.value as ThinkingLevel })} className={SELECT}>
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
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/ai/providers" />}>
            <KeyRound /> Providers
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
            <span className="font-display text-2xl text-foreground italic">What would you like to find?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={!selection?.modelId} onClick={() => void ask(s)} className="rounded-full border bg-card/70 px-3 py-1.5 text-left text-sm transition-colors hover:border-foreground/30 hover:bg-card disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
          {!selection?.modelId && <p className="text-xs text-muted-foreground">Choose a model above to begin.</p>}
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
          placeholder={selection?.modelId ? 'Ask about a case, a party, a court number, a document…' : 'Choose a model first'}
          disabled={!selection?.modelId}
          aria-label="Ask the case agent"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abort.current?.abort()}>
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || !selection?.modelId}>
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
              <span className={s.error ? 'text-destructive' : ''}>· {s.error ? s.error : `${s.found.length} found`}</span>
            </li>
          ))}
        </ul>
      )}

      {turn.pending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner size="xs" tone="current" decorative /> {turn.steps.length ? 'Reading what it found…' : 'Thinking…'}
        </p>
      )}
      {turn.error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {turn.error}
        </p>
      )}
      {turn.stopped && <p className="text-sm text-muted-foreground">Stopped.</p>}
      {turn.answer && <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-wrap">{turn.answer}</p>}
      <FoundCards found={turn.found} />
    </div>
  )
}
