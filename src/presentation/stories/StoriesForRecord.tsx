import { useState } from 'react'
import { Feather, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EntityRef } from '@/domain/shared/types'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { arcProgress, currentCheckpoint, storiesLinkedTo, toggleLink } from '@/domain/stories/Stories'
import { NativeSelect } from '@/presentation/components/form'
import { Section } from '@/presentation/components/layout'
import { Link, useNavigate } from '@/presentation/routing'
import { StoryDialog } from './parts'
import { useStoriesAvailable, useStoryAction, useStoryList } from './useStories'

/**
 * The stories that cover a case, a project or a client: each with where it is, and a way to start one already tied to the record
 * or to add the record to a story you already write. `also` are records that count too (a client's projects).
 */
export function StoriesForRecord({ refTo, workspace, title, also = [] }: { refTo: EntityRef; workspace: WorkspaceId; title: string; also?: EntityRef[] }) {
  const available = useStoriesAvailable()
  const { items, loading } = useStoryList()
  const { run, busy } = useStoryAction()
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  if (!available) return null

  const refs = [refTo, ...also]
  const linked = items.filter((s) => refs.some((r) => storiesLinkedTo([s], r).length > 0))
  // Stories of this workspace that could take the record on: not ended, and not covering it already.
  const addable = items.filter((s) => s.workspace === workspace && s.state !== 'ended' && !storiesLinkedTo([s], refTo).length)

  return (
    <Section
      title="Stories"
      description={loading ? undefined : linked.length ? `${linked.length} covering this` : 'None yet'}
      actions={
        <Button size="xs" variant="ghost" onClick={() => setStarting(true)}>
          <Plus /> Start a story
        </Button>
      }
      bodyClassName="p-2"
    >
      {linked.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">Tell this one as a story: chapters you write, checkpoints of its own, and the work each chapter leaves.</p>
      ) : (
        <ul className="grid gap-1.5">
          {linked.map((s) => {
            const here = currentCheckpoint(s)
            const progress = arcProgress(s)
            return (
              <li key={s.id}>
                <Link to={`/stories/${s.id}`} className="flex items-start gap-2.5 rounded-xl border p-3 transition-colors hover:bg-muted/40">
                  <Feather className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.state !== 'writing' ? `${s.state} · ` : ''}
                      {here ? `now at “${here.title}”` : s.checkpoints.length ? 'every checkpoint passed' : 'no checkpoints yet'}
                      {progress !== null ? ` · ${Math.round(progress * 100)}%` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {addable.length > 0 && (
        <NativeSelect
          aria-label="Add this to a story you already write"
          className="mt-2"
          value=""
          disabled={busy}
          onChange={(e) => {
            const s = addable.find((x) => x.id === e.target.value)
            if (s) void run((x) => x.stories.saveStory({ ...s, links: toggleLink(s.links ?? [], refTo) }), { success: `Added to “${s.title}”`, failure: 'Couldn’t add it' })
          }}
        >
          <option value="">Add this to a story you write…</option>
          {addable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </NativeSelect>
      )}
      <StoryDialog open={starting} onOpenChange={setStarting} start={{ workspace, links: [refTo], title }} onSaved={(s) => navigate(`/stories/${s.id}`)} />
    </Section>
  )
}
