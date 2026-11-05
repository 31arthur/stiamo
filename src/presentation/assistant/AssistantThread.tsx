import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bot, ChevronRight, Pencil, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ConversationTurn } from '@/domain/ai/AgentApi'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { EmptyState } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { toast } from '@/presentation/notifications/toast'
import { Link, useNavigate } from '@/presentation/routing'
import { FoundCards } from '@/presentation/agents/FoundCards'
import { Composer } from './Composer'
import { Markdown } from './Markdown'
import { QuickAdd } from './QuickAdd'
import { takeFirstMessage } from './pendingMessage'
import { ASSISTANT_ID, useChatAgents } from './useChatAgents'
import { useConversation, useConversationActions } from './useConversations'

/** One chat: what was said, and the box to say more. The conversation scrolls; the box and the title stay put. */
export function AssistantThread() {
  const { threadId } = useParams()
  return <Thread key={threadId} id={threadId!} />
}

function Thread({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: chat, isLoading, error } = useConversation(id)
  const agents = useChatAgents('all')
  const actions = useConversationActions()
  const def = agents.find((a) => a.id === chat?.agentId)
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ question: string; message: string } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [chat?.turns.length, waiting, failed])

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

  // A chat begun on the start screen sends its first message as soon as it opens.
  useEffect(() => {
    if (!chat || started.current) return
    const first = takeFirstMessage(id)
    if (!first) return
    started.current = true
    void ask(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, id])

  if (isLoading) {
    return (
      <div className="m-auto">
        <Spinner label="Loading" />
      </div>
    )
  }
  if (error || !chat) {
    return (
      <div className="m-auto max-w-md">
        <EmptyState title="That chat isn’t here" action={<Button variant="outline" onClick={() => navigate('/assistant')}>Start a new one</Button>}>
          It may have been deleted.
        </EmptyState>
      </div>
    )
  }

  const empty = chat.turns.length === 0 && !waiting && !failed

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
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
              className="w-full max-w-md rounded-md border bg-background px-2 py-1 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          ) : (
            <button type="button" onClick={() => setRenaming(true)} className="group flex max-w-full items-center gap-2 text-left" title="Rename">
              <h1 className="truncate text-sm font-medium">{chat.title}</h1>
              <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border bg-card/70 px-2.5 py-1 text-xs text-muted-foreground">
          {chat.workspace !== 'all' && <WorkspaceDot ws={chat.workspace as WorkspaceId} />}
          <Bot className="size-3" /> <span className="max-sm:hidden">{def?.name ?? chat.agentId}</span>
        </span>
        <ConfirmDelete
          what={`“${chat.title}”`}
          onConfirm={async () => {
            await actions.remove(id)
            navigate('/assistant')
          }}
        >
          <Trash2 className="size-4" />
        </ConfirmDelete>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-3 py-5 sm:gap-8 sm:px-4 sm:py-6">
          {def && !def.selection && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              {def.id === ASSISTANT_ID ? 'No agent has a model yet.' : `${def.name} has no model yet.`}{' '}
              <Link to={def.id === ASSISTANT_ID ? '/agents' : `/agents/${def.id}/settings`} className="font-medium underline">
                Choose one
              </Link>{' '}
              and it can answer.
            </p>
          )}
          {empty && (
            <div className="grid gap-3 py-8 text-center">
              <h2 className="font-display text-3xl italic">What would you like to ask?</h2>
              <div className="flex flex-wrap justify-center gap-2">
                {(def?.suggestions ?? []).map((s) => (
                  <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border bg-card/70 px-3 py-1.5 text-sm transition-colors hover:border-foreground/30 hover:bg-card">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.turns.map((t) => (
            <TurnView key={t.id} turn={t} />
          ))}
          {waiting && (
            <div className="grid gap-4">
              <Question>{waiting}</Question>
              <Typing name={def?.name ?? 'The agent'} />
            </div>
          )}
          {failed && (
            <div className="grid gap-4">
              <Question>{failed.question}</Question>
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                {failed.message}{' '}
                <button type="button" className="font-medium underline" onClick={() => void ask(failed.question)}>
                  Try again
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-3xl">
          <Composer value={text} onChange={setText} onSend={() => void ask(text)} busy={!!waiting} placeholder={`Message ${def?.name ?? 'the agent'}…`} footer={<QuickAdd />} />
        </div>
      </div>
    </>
  )
}

function Question({ children }: { children: string }) {
  return <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-muted px-4 py-2.5 text-[15px] break-words whitespace-pre-wrap">{children}</div>
}

function Typing({ name }: { name: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
      <Avatar />
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="size-1.5 rounded-full bg-muted-foreground/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
        ))}
      </span>
      <span className="sr-only">{name} is working on it</span>
    </div>
  )
}

function Avatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Bot className="size-4" />
    </span>
  )
}

function TurnView({ turn }: { turn: ConversationTurn }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
      <Question>{turn.question}</Question>
      <div className="flex gap-3">
        <Avatar />
        <div className="grid min-w-0 flex-1 gap-3">
          {turn.agentName && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={turn.why ? `Chosen because: ${turn.why}` : undefined}>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{turn.agentName}</span>
              {turn.routedBy === 'jev' && <span>chosen by Jev</span>}
            </p>
          )}
          {turn.steps.length > 0 && <Steps steps={turn.steps} />}
          <Markdown>{turn.answer || 'I found nothing to say about that.'}</Markdown>
          {turn.found.length > 0 && <FoundCards found={turn.found} />}
        </div>
      </div>
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
