import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, EyeOff, Newspaper, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { NewsSort, NewsStory } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { useScope } from '@/presentation/app/workspaceFilter'
import { EmptyState, PageHeader } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { ago } from './format'
import { useNews } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const PERIODS = [
  { value: 1, label: 'Last 24 hours' },
  { value: 3, label: 'Last 3 days' },
  { value: 7, label: 'Last 7 days' },
]
const LEVEL: Record<string, { text: string; tone: string }> = {
  critical: { text: 'Critical', tone: 'bg-destructive/10 text-destructive' },
  major: { text: 'Major', tone: 'bg-warning/15 text-warning' },
  notable: { text: 'Notable', tone: 'bg-muted text-foreground' },
  minor: { text: 'Minor', tone: 'bg-muted text-muted-foreground' },
}

/** The top stories your news agents found relevant: the most important and recent first. */
export function NewsPage() {
  const scope = useScope()
  const here = scope === 'all' ? null : WORKSPACES[scope]
  const [days, setDays] = useState(3)
  const [sort, setSort] = useState<NewsSort>('importance')
  const { data, isLoading, error, isFetching, refetch } = useNews(scope === 'all' ? undefined : scope, days, sort)
  const items = data?.items ?? []

  return (
    <>
      <PageHeader
        eyebrow={here ? here.name : 'All workspaces'}
        title="News"
        description="Up to twenty stories at a time from the feeds your news agent reads, all judged relevant to your work. Choose what matters most, or what is newest."
        actions={
          <>
            {sort === 'importance' && (
              <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className={SELECT}>
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? <Spinner size="xs" tone="current" decorative /> : <RefreshCw />} Refresh
            </Button>
          </>
        }
      />
      <div role="tablist" aria-label="Ranking" className="flex gap-1 border-b">
        {([['importance', 'Most important', 'The ones that matter most to your work first; the newer first when they matter equally.'], ['latest', 'Latest', 'The newest first, only from the last three hours.']] as const).map(([id, label, hint]) => (
          <button key={id} type="button" role="tab" aria-selected={sort === id} title={hint} onClick={() => setSort(id)} className={cn('-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition-colors', sort === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Spinner label="Loading" />
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the news.'}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed">
          <EmptyState
            title={sort === 'latest' ? 'Nothing in the last three hours' : 'No stories yet'}
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/agents/new" />}>
                <Newspaper /> Set up a news agent
              </Button>
            }
          >
            {sort === 'latest' ? 'Stories appear here as soon as they are published and found relevant, and leave after three hours. The agent checks again every half hour.' : 'When a news agent has read its feeds and found relevant stories, the top twenty appear here. It checks again every half hour.'}
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="-mt-2 text-xs text-muted-foreground">
            {sort === 'importance' ? 'Most important first' : 'Newest first, from the last three hours'}: {items.length} of {data?.total} relevant stories{data?.generatedAt ? ` · updated ${ago(data.generatedAt)}` : ''}.
          </p>
          <ol className="grid gap-3">
            <AnimatePresence initial={false}>
              {items.map((s, i) => (
                <Story key={`${s.agentId}/${s.itemId}`} story={s} place={i + 1} />
              ))}
            </AnimatePresence>
          </ol>
        </>
      )}
    </>
  )
}

function Story({ story: s, place }: { story: NewsStory; place: number }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const level = s.importance ? LEVEL[s.importance] : undefined

  /** Off the page at once; the server is told in the background. */
  async function hide() {
    const key = ['agent', 'news', userId]
    const before = client.getQueriesData<{ items: NewsStory[] }>({ queryKey: key })
    client.setQueriesData<{ items: NewsStory[] }>({ queryKey: key }, (d) => d && { ...d, items: d.items.filter((x) => x.itemId !== s.itemId || x.agentId !== s.agentId) })
    try {
      await agent.hideNews(s.agentId, s.itemId)
    } catch (e) {
      for (const [k, d] of before) client.setQueryData(k, d)
      toast.error('Couldn’t take it off. It is back.', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24, height: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
      <article className="group flex gap-3 rounded-2xl border bg-card/80 p-3.5 transition-colors hover:border-foreground/25">
        <span className="w-6 shrink-0 pt-0.5 text-right font-display text-xl text-muted-foreground tabular-nums">{place}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {level && <span className={cn('rounded-full px-2 py-0.5 font-medium', level.tone)}>{level.text}</span>}
            <span className="font-medium text-foreground">{s.source ?? 'Unknown source'}</span>
            {s.publishedAt && <span>{ago(s.publishedAt)}</span>}
            {s.lang && s.lang !== 'en' && <span className="rounded bg-muted px-1 font-mono uppercase">{s.lang}</span>}
          </div>
          <h3 className="font-semibold break-words">
            {s.link ? (
              <a href={s.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {s.title}
              </a>
            ) : (
              s.title
            )}
          </h3>
          {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
          <div className="mt-2 flex items-center gap-1">
            {s.link && (
              <Button variant="ghost" size="xs" nativeButton={false} render={<a href={s.link} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink /> Read the story
              </Button>
            )}
            <Button variant="ghost" size="xs" onClick={() => void hide()} className="text-muted-foreground">
              <EyeOff /> Not for this page
            </Button>
          </div>
        </div>
        {s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} className="hidden h-24 w-36 shrink-0 rounded-xl bg-muted object-cover sm:block" />}
      </article>
    </motion.li>
  )
}
