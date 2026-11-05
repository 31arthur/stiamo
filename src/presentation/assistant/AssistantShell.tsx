import { Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate as useRouterNavigate, useOutlet, useParams } from 'react-router-dom'
import { ArrowLeft, Code2, Menu, MessageSquarePlus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { ConversationSummary } from '@/domain/ai/AgentApi'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId, WorkspaceScope } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useScope } from '@/presentation/app/workspaceFilter'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { Logo } from '@/presentation/layout/Logo'
import { PageLoader } from '@/presentation/components/loading'
import { Link, NavLink, useNavigate } from '@/presentation/routing'
import { ago } from '@/presentation/agents/format'
import { useAgentAvailable } from '@/presentation/agents/useAgent'
import { groupChats } from './chatGroups'
import { useChatAgents } from './useChatAgents'
import { useConversationActions, useConversations } from './useConversations'

/**
 * The Assistant has the whole screen to itself: its own sidebar of chats, and the conversation. Stiamo is one click back.
 */
export function AssistantShell() {
  const outlet = useOutlet()
  const [open, setOpen] = useState(false)
  const { threadId } = useParams()
  useDocumentTitle('Assistant')
  useEffect(() => setOpen(false), [threadId])

  return (
    <div className="bg-ambient flex h-dvh overflow-hidden">
      <aside className="glass hidden w-72 shrink-0 border-r lg:block">
        <ChatSidebar />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Chats</SheetTitle>
          <ChatSidebar />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass flex h-12 shrink-0 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] lg:hidden">
          <Button variant="ghost" size="icon-sm" aria-label="Chats" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <span className="font-display text-lg">Assistant</span>
        </div>
        <main className="flex min-h-0 flex-1 flex-col">
          <Suspense fallback={<PageLoader />}>{outlet}</Suspense>
        </main>
      </div>
    </div>
  )
}

function ChatSidebar() {
  const scope = useScope()
  const { threadId } = useParams()
  const navigate = useNavigate()
  const goTo = useRouterNavigate()
  const available = useAgentAvailable()
  const list = useConversations(scope)
  const agents = useChatAgents(scope)
  const actions = useConversationActions()
  const [query, setQuery] = useState('')
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id

  const groups = useMemo(() => groupChats((list.data ?? []).filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))), [list.data, query])
  const scopes: { id: WorkspaceScope; label: string }[] = [{ id: 'all', label: 'All workspaces' }, ...WORKSPACE_IDS.map((id) => ({ id, label: WORKSPACES[id].name }))]

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between px-1 pt-1">
        <Logo />
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link to="/today" />} className="text-muted-foreground">
          <ArrowLeft /> Stiamo
        </Button>
      </div>

      <label className="relative block">
        <span className="sr-only">Workspace</span>
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">{scope === 'all' ? <span className="inline-block size-2 rounded-full bg-muted-foreground/50" /> : <WorkspaceDot ws={scope} />}</span>
        <select value={scope} onChange={(e) => goTo(`/${e.target.value}/assistant`)} className="h-9 w-full appearance-none rounded-lg border border-input bg-transparent pr-2 pl-7 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
          {scopes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <Button onClick={() => navigate('/assistant')} className="w-full justify-start gap-2">
        <MessageSquarePlus /> New chat
      </Button>

      {(list.data?.length ?? 0) > 6 && (
        <label className="relative block">
          <span className="sr-only">Search chats</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </label>
      )}

      <nav aria-label="Your chats" className="scrollbar-none -mx-1 flex-1 overflow-y-auto px-1">
        {!available ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Chats need the Stiamo backend.</p>
        ) : list.isLoading ? (
          <Spinner label="Loading" />
        ) : groups.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">{query ? 'No chat has that in its name.' : 'Your chats will be kept here.'}</p>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-3">
              <h2 className="px-2.5 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/80 uppercase">{g.label}</h2>
              <ul className="grid gap-0.5">
                {g.items.map((c) => (
                  <ChatRow key={c.id} chat={c} agent={name(c.agentId)} active={threadId === c.id} onDelete={async () => (await actions.remove(c.id), threadId === c.id && navigate('/assistant'))} />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      <Link to="/agents" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
        <Code2 className="size-4" /> Developer
      </Link>
    </div>
  )
}

function ChatRow({ chat: c, agent, active, onDelete }: { chat: ConversationSummary; agent: string; active: boolean; onDelete: () => Promise<unknown> }) {
  return (
    <li className="group relative">
      <NavLink to={`/assistant/${c.id}`} className={cn('block rounded-lg px-2.5 py-2 pr-9 text-sm transition-colors', active ? 'bg-foreground/[0.07] font-medium' : 'text-foreground/80 hover:bg-muted/60')}>
        <span className="block truncate">{c.title}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
          {c.workspace !== 'all' && <WorkspaceDot ws={c.workspace as WorkspaceId} className="size-1.5" />}
          <span className="truncate">{agent}</span>
          <span className="shrink-0">· {ago(c.updatedAt)}</span>
        </span>
      </NavLink>
      <span className="absolute top-1.5 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
        <ConfirmDelete what={`“${c.title}”`} onConfirm={onDelete}>
          <Trash2 className="size-3.5" />
        </ConfirmDelete>
      </span>
    </li>
  )
}
