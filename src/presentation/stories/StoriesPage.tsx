import { useMemo, useState } from 'react'
import { BookOpenText, Feather, Hourglass, Plus, Settings2, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { WORKSPACES } from '@/domain/shared/workspace'
import { arcProgress, currentCheckpoint } from '@/domain/stories/Stories'
import type { Story, StoryMomentum, StoryState } from '@/domain/stories/Stories'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { Segmented } from '@/presentation/components/form'
import { PageHeader } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { Link, useNavigate } from '@/presentation/routing'
import { EditorSheet } from './EditorSheet'
import { ArcTrack, StoryDialog } from './parts'
import { useEditorOverview, useStoriesAvailable, useStoryList } from './useStories'

/** Your stories: each a running thing you write in chapters, ordered by which most deserves your next hour. */
export function StoriesPage() {
  useDocumentTitle('Stories')
  const { scope } = useWorkspaceFilter()
  const available = useStoriesAvailable()
  const { items, loading, error } = useStoryList()
  const overview = useEditorOverview()
  const navigate = useNavigate()
  const [state, setState] = useState<StoryState>('writing')
  const [creating, setCreating] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const momentum = useMemo(() => new Map((overview.data?.stories ?? []).map((m) => [m.id, m])), [overview.data])
  const shown = items
    .filter((s) => (scope === 'all' || s.workspace === scope) && (s.state ?? 'writing') === state)
    .sort((a, b) => (momentum.get(b.id)?.score ?? 0) - (momentum.get(a.id)?.score ?? 0) || a.title.localeCompare(b.title))
  const counts = { writing: 0, resting: 0, ended: 0 } as Record<StoryState, number>
  for (const s of items) if (scope === 'all' || s.workspace === scope) counts[s.state ?? 'writing']++

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Stories"
        description="Every running thing as a story you write: a case, a project, a loan. Each has its own checkpoints and the ending you want; each chapter can leave work behind."
        actions={
          available && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
                <Settings2 /> The editor
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> New story
              </Button>
            </>
          )
        }
      />

      {!available ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Stories need the Stiamo backend.</p>
      ) : loading ? (
        <Spinner label="Loading stories" />
      ) : error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      ) : (
        <div className="grid gap-4">
          <Segmented
            label="Which stories"
            value={state}
            onChange={setState}
            options={[
              { value: 'writing', label: `Writing · ${counts.writing}` },
              { value: 'resting', label: `Resting · ${counts.resting}` },
              { value: 'ended', label: `Ended · ${counts.ended}` },
            ]}
          />
          {shown.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted">
                <BookOpenText className="size-5" />
              </span>
              <div>
                <p className="font-medium">{state === 'writing' ? 'No stories being written here yet' : `No ${state} stories`}</p>
                {state === 'writing' && <p className="mt-1 max-w-md text-sm text-muted-foreground">Start one for anything that runs over weeks: a matter, a client, an errand. You can also tell the assistant on your phone: “Start a story for the home loan”.</p>}
              </div>
              {state === 'writing' && (
                <Button onClick={() => setCreating(true)}>
                  <Feather /> Start a story
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {shown.map((s) => (
                <li key={s.id}>
                  <StoryCard story={s} momentum={momentum.get(s.id)} showWorkspace={scope === 'all'} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {available && <StoryDialog open={creating} onOpenChange={setCreating} onSaved={(s) => navigate(`/stories/${s.id}`)} />}
      {available && <EditorSheet open={editorOpen} onOpenChange={setEditorOpen} />}
    </>
  )
}

const STATE_TONE: Record<StoryMomentum['state'], { label: string; tone: string; icon: typeof Wind }> = {
  moving: { label: 'Moving', tone: 'bg-success/12 text-success', icon: Feather },
  waiting: { label: 'Waiting', tone: 'bg-warning/15 text-warning', icon: Hourglass },
  quiet: { label: 'Gone quiet', tone: 'bg-destructive/10 text-destructive', icon: Wind },
  resting: { label: 'Resting', tone: 'bg-muted text-muted-foreground', icon: Hourglass },
  ended: { label: 'Ended', tone: 'bg-muted text-muted-foreground', icon: BookOpenText },
}

function StoryCard({ story: s, momentum: m, showWorkspace }: { story: Story; momentum?: StoryMomentum; showWorkspace: boolean }) {
  const here = currentCheckpoint(s)
  const progress = arcProgress(s)
  const tone = m ? STATE_TONE[m.state] : null
  return (
    <Link to={`/stories/${s.id}`} className="grid h-full content-start gap-3 rounded-2xl border bg-card/80 p-4 transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {showWorkspace && <WorkspaceDot ws={s.workspace} />}
        {tone && (
          <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium', tone.tone)}>
            <tone.icon className="size-3" /> {tone.label}
            {m && m.state === 'quiet' ? ` · ${m.quietDays} days` : ''}
          </span>
        )}
        {s.chance !== undefined && <span className="rounded-md bg-muted px-1.5 py-0.5 tabular-nums">{s.chance}%</span>}
        <span className="rounded-md bg-muted px-1.5 py-0.5">Stakes {s.stakes}</span>
      </div>
      <div>
        <h2 className="font-display text-2xl leading-tight">{s.title}</h2>
        {s.ending && <p className="mt-0.5 text-sm text-muted-foreground italic">→ {s.ending}</p>}
      </div>
      <ArcTrack checkpoints={s.checkpoints} compact />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{here ? `Now at “${here.title}”` : s.checkpoints.length ? 'Every checkpoint passed' : 'No checkpoints yet'}</span>
        {progress !== null && <span className="tabular-nums">{Math.round(progress * 100)}% of the arc</span>}
      </div>
      {s.waitingOn && <p className="text-xs">⏳ Waiting on {s.waitingOn.on}{s.waitingOn.until ? ` until ${s.waitingOn.until}` : ''}</p>}
      {m && m.score > 0 && <p className="text-[11px] text-muted-foreground">Push score {m.score} · {m.why}</p>}
    </Link>
  )
}
