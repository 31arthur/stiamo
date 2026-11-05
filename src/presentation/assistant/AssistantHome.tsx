import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Bot, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { useScope } from '@/presentation/app/workspaceFilter'
import { EmptyState } from '@/presentation/components/layout'
import { toast } from '@/presentation/notifications/toast'
import { Link, useNavigate } from '@/presentation/routing'
import { useAgentAvailable } from '@/presentation/agents/useAgent'
import { Composer } from './Composer'
import { QuickAdd } from './QuickAdd'
import { holdFirstMessage } from './pendingMessage'
import { lastAgent, rememberAgent, useChatAgents } from './useChatAgents'
import { useConversationActions } from './useConversations'

const greeting = (hour: number) => (hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')

/** A new chat: choose who to talk to, and say what you need. The chat is made when the first message is sent. */
export function AssistantHome() {
  const scope = useScope()
  const available = useAgentAvailable()
  const agents = useChatAgents(scope)
  const { user } = useAuth()
  const navigate = useNavigate()
  const actions = useConversationActions()
  const [picked, setPicked] = useState<string | null>(lastAgent())
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const agent = agents.find((a) => a.id === picked) ?? agents[0]

  useEffect(() => {
    if (agent) rememberAgent(agent.id)
  }, [agent])

  async function send(message: string) {
    const m = message.trim()
    if (!agent || !m || busy) return
    setBusy(true)
    try {
      const c = await actions.start(agent.id, scope)
      holdFirstMessage(c.id, m)
      navigate(`/assistant/${c.id}`)
    } catch (e) {
      setBusy(false)
      toast.error('Couldn’t start the chat', { description: e instanceof Error ? e.message : undefined })
    }
  }

  if (!available) {
    return (
      <div className="m-auto max-w-md">
        <EmptyState title="The assistant needs the Stiamo backend">Your chats with the team are kept on the server, so they are only here when the app is connected to it.</EmptyState>
      </div>
    )
  }
  if (!agent) {
    return (
      <div className="m-auto max-w-md">
        <EmptyState title="No assistants in this workspace">Choose which workspaces an agent is shown in under Developer.</EmptyState>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-7 px-4 py-10">
        <header className="grid gap-1.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-4" /> {greeting(new Date().getHours())}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">What shall we work on?</h1>
        </header>

        <div role="radiogroup" aria-label="Who to talk to" className="flex flex-wrap justify-center gap-1.5">
          {agents.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={a.id === agent.id} onClick={() => setPicked(a.id)} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors', a.id === agent.id ? 'border-foreground/40 bg-background font-medium shadow-float' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
              <Bot className="size-3.5" /> {a.name}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <Composer
            value={text}
            onChange={setText}
            onSend={() => void send(text)}
            busy={busy}
            autoFocus
            placeholder={`Message ${agent.name}…`}
            footer={<QuickAdd />}
          />
          <p className="text-center text-xs text-muted-foreground">
            {agent.description}{' '}
            {agent.selection ? (
              <span className="whitespace-nowrap">· {agent.selection.modelId}</span>
            ) : (
              <Link to={`/agents/${agent.id}/settings`} className="underline">
                Choose a model
              </Link>
            )}
          </p>
        </div>

        {agent.suggestions.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {agent.suggestions.slice(0, 4).map((s) => (
              <li key={s}>
                <button type="button" disabled={busy} onClick={() => void send(s)} className="h-full w-full rounded-2xl border bg-card/70 px-4 py-3 text-left text-sm transition-all hover:-translate-y-px hover:border-foreground/25 hover:bg-card hover:shadow-float disabled:opacity-50">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  )
}
