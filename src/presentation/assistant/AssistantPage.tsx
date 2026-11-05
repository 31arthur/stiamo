import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowUp, Bot, ChevronRight, MessageSquarePlus, Pencil, Sparkles, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSummary, ConversationSummary, ConversationTurn } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useScope } from '@/presentation/app/workspaceFilter'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { EmptyState, PageHeader } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useIsCompact } from '@/presentation/layout/useMediaQuery'
import { toast } from '@/presentation/notifications/toast'
import { Link, NavLink, useNavigate } from '@/presentation/routing'
import { FoundCards } from '@/presentation/agents/FoundCards'
import { ago } from '@/presentation/agents/format'
import { useAgentAvailable, useAgentSettings } from '@/presentation/agents/useAgent'
import { Markdown } from './Markdown'
import { useConversation, useConversationActions, useConversations } from './useConversations'

/** What was typed on the start screen, waiting for its new chat to open and send it. */
const FIRST_MESSAGE = new Map<string, string>()

/** The agents that can be talked to here: the team (not the ones built for one job), those shown in this workspace. */
function useChatAgents(scope: string): AgentSummary[] {
  const { settings } = useAgentSettings()
  return useMemo(() => {
    const all = (settings?.agents ?? []).filter((a) => a.kind !== 'workflow' && (scope === 'all' || a.workspaces.includes(scope)))
    return [...all].sort((a, b) => Number(b.id === 'daily-planner') - Number(a.id === 'daily-planner'))
  }, [settings, scope])
}

/** Talk to the team: a list of your chats, and the one that is open. Each chat is with one agent and stays on the server. */
export function AssistantPage() {
  const { threadId } = useParams()
  const scope = useScope()
  const available = useAgentAvailable()
  const compact = useIsCompact()
  const agents = useChatAgents(scope)
  const list = useConversations(scope)

  if (!available) {
    return (
      <div className="rounded-2xl border-2 border-dashed">
        <EmptyState title="The assistant needs the Stiamo backend">Your chats with the team are kept on the server, so they are only here when the app is connected to it.</EmptyState>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      {(!compact || !threadId) && <ThreadList items={list.data ?? []} loading={list.isLoading} agents={agents} active={threadId} />}
      {(!compact || threadId) && (threadId ? <Thread key={threadId} id={threadId} agents={agents} /> : <Start agents={agents} scope={scope} />)}
    </div>
  )
}

// --- the list of chats ---------------------------------------------------------------------------------------------

function ThreadList({ items, loading, agents, active }: { items: ConversationSummary[]; loading: boolean; agents: AgentSummary[]; active?: string }) {
  const navigate = useNavigate()
  const actions = useConversationActions()
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id
  return (
    <aside aria-label="Your chats" className="grid content-start gap-2 lg:sticky lg:top-4">
      <Button variant="outline" onClick={() => navigate('/assistant')} className="w-full justify-start">
        <MessageSquarePlus /> New chat
      </Button>
      {loading ? (
        <Spinner label="Loading" />
      ) : items.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">No chats yet. Start one and it will be kept here.</p>
      ) : (
        <ul className="grid gap-0.5">
          {items.map((c) => (
            <li key={c.id} className="group relative">
              <NavLink to={`/assistant/${c.id}`} className={({ isActive }) => cn('block rounded-lg px-2.5 py-2 pr-8 text-sm transition-colors', isActive || active === c.id ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
                <span className="block truncate">{c.title}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {c.workspace !== 'all' && <WorkspaceDot ws={c.workspace as WorkspaceId} className="size-1.5" />}
                  <span className="truncate">{name(c.agentId)}</span>
                  <span>· {ago(c.updatedAt)}</span>
                </span>
              </NavLink>
              <span className="absolute top-1.5 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
                <ConfirmDelete
                  what={`“${c.title}”`}
                  onConfirm={async () => {
                    await actions.remove(c.id)
                    if (active === c.id) navigate('/assistant')
                  }}
                >
                  <Trash2 className="size-3.5" />
                </ConfirmDelete>
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

// --- starting a chat -----------------------------------------------------------------------------------------------

function Start({ agents, scope }: { agents: AgentSummary[]; scope: string }) {
  const navigate = useNavigate()
  const actions = useConversationActions()
  const [starting, setStarting] = useState<string | null>(null)

  async function begin(agent: AgentSummary, first?: string) {
    setStarting(agent.id)
    try {
      const c = await actions.start(agent.id, scope)
      if (first) FIRST_MESSAGE.set(c.id, first)
      navigate(`/assistant/${c.id}`)
    } catch (e) {
      setStarting(null)
      toast.error('Couldn’t start the chat', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <section className="grid gap-5">
      <PageHeader eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope as WorkspaceId].name} title="Assistant" description="Talk to the team: plan the day, prepare a hearing, decide who to call, add tasks and follow-ups. Each chat is kept, and nothing is saved until you approve it." />
      {agents.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed">
          <EmptyState title="No assistants in this workspace">Choose which workspaces an agent is shown in under Developer → Agents.</EmptyState>
        </div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {agents.map((a) => (
            <li key={a.id} className="grid content-start gap-3 rounded-2xl border bg-card/80 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{starting === a.id ? <Spinner size="xs" tone="current" decorative /> : <Bot className="size-4.5" />}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{a.name}</h2>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
                <Button size="xs" onClick={() => void begin(a)} disabled={starting !== null}>
                  <MessageSquarePlus /> Chat
                </Button>
              </div>
              {a.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {a.suggestions.slice(0, 4).map((s) => (
                    <button key={s} type="button" disabled={starting !== null} onClick={() => void begin(a, s)} className="rounded-full border bg-background/60 px-2.5 py-1 text-left text-xs transition-colors hover:border-foreground/30 hover:bg-background disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {!a.selection && (
                <p className="text-xs text-muted-foreground">
                  No model chosen yet.{' '}
                  <Link to={`/agents/${a.id}/settings`} className="underline">
                    Choose one
                  </Link>
                  .
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- one chat ------------------------------------------------------------------------------------------------------

function Thread({ id, agents }: { id: string; agents: AgentSummary[] }) {
  const navigate = useNavigate()
  const compact = useIsCompact()
  const { data: chat, isLoading, error } = useConversation(id)
  const actions = useConversationActions()
  const def = agents.find((a) => a.id === chat?.agentId)
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ question: string; message: string } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const sentFirst = useRef(false)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat?.turns.length, waiting])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || waiting) return
    setWaiting(q)
    setFailed(null)
    setText('')
    try {
      await actions.say(id, q)
    } catch (e) {
      setFailed({ question: q, message: e instanceof Error ? e.message : 'Something went wrong.' })
    } finally {
      setWaiting(null)
    }
  }

  // A chat begun from a suggestion sends it as soon as it opens.
  useEffect(() => {
    const first = FIRST_MESSAGE.get(id)
    if (!first || !chat || sentFirst.current) return
    sentFirst.current = true
    FIRST_MESSAGE.delete(id)
    void ask(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, id])

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

  if (isLoading) return <Spinner label="Loading" />
  if (error || !chat) {
    return (
      <div className="rounded-2xl border-2 border-dashed">
        <EmptyState title="That chat isn’t here" action={<Button variant="outline" onClick={() => navigate('/assistant')}>Start a new one</Button>}>
          It may have been deleted.
        </EmptyState>
      </div>
    )
  }

  return (
    <section className="grid gap-4 pb-24 lg:pb-8">
      <header className="flex items-center gap-2">
        {compact && (
          <Button variant="ghost" size="icon-sm" aria-label="All chats" onClick={() => navigate('/assistant')}>
            <ArrowLeft />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              defaultValue={chat.title}
              aria-label="Chat name"
              onBlur={(e) => {
                const v = e.target.value.trim()
                setRenaming(false)
                if (v && v !== chat.title) void actions.rename(id, v).catch(() => toast.error('Couldn’t rename it'))
              }}
              onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setRenaming(false))}
              className="w-full rounded-md border bg-background px-2 py-1 font-display text-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          ) : (
            <button type="button" onClick={() => setRenaming(true)} className="group flex max-w-full items-center gap-2 text-left" title="Rename">
              <h1 className="truncate font-display text-2xl tracking-tight">{chat.title}</h1>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {chat.workspace !== 'all' && <WorkspaceDot ws={chat.workspace as WorkspaceId} />}
            <Bot className="size-3" /> {def?.name ?? chat.agentId}
          </p>
        </div>
      </header>

      {def && !def.selection && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {def.name} has no model yet.{' '}
          <Link to={`/agents/${def.id}/settings`} className="font-medium underline">
            Choose one
          </Link>{' '}
          and it can answer.
        </p>
      )}

      {chat.turns.length === 0 && !waiting ? (
        <div className="grid gap-3 py-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-5" />
            <span className="font-display text-2xl text-foreground italic">What would you like to ask?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(def?.suggestions ?? []).map((s) => (
              <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border bg-card/70 px-3 py-1.5 text-left text-sm transition-colors hover:border-foreground/30 hover:bg-card">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-7">
          {chat.turns.map((t) => (
            <TurnView key={t.id} turn={t} agent={def?.name ?? 'The agent'} />
          ))}
          {waiting && (
            <div className="grid gap-3">
              <Bubble>{waiting}</Bubble>
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size="xs" tone="current" decorative /> {def?.name ?? 'The agent'} is working on it…
              </p>
            </div>
          )}
          {failed && (
            <div className="grid gap-3">
              <Bubble>{failed.question}</Bubble>
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                {failed.message}{' '}
                <button type="button" className="font-medium underline" onClick={() => void ask(failed.question)}>
                  Try again
                </button>
              </p>
            </div>
          )}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={submit} className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex items-end gap-2 rounded-2xl border bg-background/95 p-2 shadow-lift backdrop-blur lg:bottom-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} rows={1} placeholder={`Message ${def?.name ?? 'the agent'}…`} aria-label="Message" className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || !!waiting}>
          {waiting ? <Spinner size="xs" tone="current" decorative /> : <ArrowUp />}
        </Button>
      </form>
    </section>
  )
}

function Bubble({ children }: { children: string }) {
  return <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-background">{children}</div>
}

function TurnView({ turn, agent }: { turn: ConversationTurn; agent: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3">
      <Bubble>{turn.question}</Bubble>
      {turn.steps.length > 0 && <Steps steps={turn.steps} />}
      <div aria-label={`${agent} says`} className="max-w-[48rem]">
        <Markdown>{turn.answer || 'I found nothing to say about that.'}</Markdown>
      </div>
      {turn.found.length > 0 && <FoundCards found={turn.found} />}
    </motion.div>
  )
}

/** What the agent looked at, folded away: it is there to check, not to read. */
function Steps({ steps }: { steps: ConversationTurn['steps'] }) {
  const [open, setOpen] = useState(false)
  const failed = steps.filter((s) => s.error).length
  return (
    <div className="text-xs text-muted-foreground">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 hover:text-foreground">
        <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        <Wrench className="size-3" /> Looked up {steps.length} {steps.length === 1 ? 'thing' : 'things'}
        {failed > 0 && <span className="text-destructive">· {failed} failed</span>}
      </button>
      {open && (
        <ul className="mt-1 grid gap-0.5 pl-4">
          {steps.map((s, i) => (
            <li key={i} className="truncate">
              {s.label} <span className={s.error ? 'text-destructive' : ''}>· {s.error ? s.error : `${s.found} found`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
