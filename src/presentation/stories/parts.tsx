import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { WORKSPACE_IDS } from '@/domain/shared/workspace'
import { BEAT_LABEL, LINKS_BY_WORKSPACE, PACING_LABEL, checkpointsFromLines, currentCheckpoint, linksAllowed, sameRef, toggleLink } from '@/domain/stories/Stories'
import type { EntityRef } from '@/domain/shared/types'
import type { Beat, Checkpoint, Pacing, Story } from '@/domain/stories/Stories'
import { Field, NativeSelect, Segmented } from '@/presentation/components/form'
import { WorkspacePicker } from '@/presentation/components/workspace'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { useLinkables } from './useLinkables'
import { X } from 'lucide-react'
import { useArcTemplates, useStoryAction } from './useStories'

const newId = () => crypto.randomUUID()

// --- the arc --------------------------------------------------------------------------------------------------------

/** The story's checkpoints as a track: passed ones filled, where it is ringed, twists as diamonds, the ending at the far end. */
export function ArcTrack({ checkpoints, ending, compact = false }: { checkpoints: Checkpoint[]; ending?: string; compact?: boolean }) {
  const here = currentCheckpoint({ checkpoints })
  if (!checkpoints.length) return <p className="text-xs text-muted-foreground">No checkpoints yet. Write them, or let a chapter’s twists add them.</p>
  return (
    <div className="overflow-x-auto pb-1">
      <ol className={cn('flex min-w-max items-start', compact ? 'gap-0' : 'gap-0 pt-1')} aria-label="Checkpoints">
        {checkpoints.map((c, i) => {
          const passed = c.status !== 'ahead'
          const isHere = here?.id === c.id
          const twist = c.addedBy === 'twist'
          return (
            <li key={c.id} className="flex items-start">
              <div className={cn('grid justify-items-center gap-1.5', compact ? 'w-16' : 'w-24')}>
                <span
                  title={`${c.title}${c.status === 'skipped' ? ' (skipped)' : ''}`}
                  className={cn(
                    'grid size-3.5 place-items-center border-2',
                    twist ? 'rotate-45 rounded-[3px]' : 'rounded-full',
                    passed ? (c.status === 'skipped' ? 'border-muted-foreground/40 bg-muted' : 'border-success bg-success') : isHere ? 'size-4 border-primary bg-background ring-4 ring-primary/15' : 'border-muted-foreground/40 bg-background',
                    twist && !passed && !isHere && 'border-ws-media bg-ws-media-soft',
                  )}
                />
                {!compact && (
                  <span className={cn('line-clamp-2 px-1 text-center text-[11px] leading-tight', isHere ? 'font-semibold text-foreground' : 'text-muted-foreground', c.status === 'skipped' && 'line-through')}>
                    {c.title}
                  </span>
                )}
              </div>
              {i < checkpoints.length - 1 && <span className={cn('mt-[6px] h-0.5', compact ? 'w-3' : 'w-6', passed ? 'bg-success' : 'bg-border')} />}
            </li>
          )
        })}
        {ending && !compact && (
          <li className="flex items-start">
            <span className="mt-[6px] h-0.5 w-6 bg-border" />
            <div className="grid w-28 justify-items-center gap-1.5">
              <span className="size-3.5 rounded-[3px] border-2 border-foreground/70 bg-background" />
              <span className="line-clamp-2 px-1 text-center text-[11px] leading-tight text-muted-foreground italic">{ending}</span>
            </div>
          </li>
        )}
      </ol>
    </div>
  )
}

const BEAT_TONE: Record<Beat, string> = {
  progress: 'bg-success/12 text-success',
  breakthrough: 'bg-primary/12 text-primary',
  setback: 'bg-destructive/10 text-destructive',
  twist: 'bg-ws-media-soft text-ws-media',
  lull: 'bg-warning/15 text-warning',
  note: 'bg-muted text-muted-foreground',
  epilogue: 'bg-muted text-foreground',
}

export function BeatChip({ beat }: { beat: Beat }) {
  return <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', BEAT_TONE[beat])}>{BEAT_LABEL[beat]}</span>
}

/** The chance of the ending, chapter by chapter. */
export function ChanceTrend({ points, current }: { points: { number: number; chance: number }[]; current?: number }) {
  const values = points.map((p) => p.chance)
  if (current !== undefined && (values.length === 0 || values[values.length - 1] !== current)) values.push(current)
  if (values.length < 2) return current !== undefined ? <span className="font-display text-3xl">{current}%</span> : <span className="text-sm text-muted-foreground">Not set</span>
  const w = 160
  const h = 40
  const x = (i: number) => (i / (values.length - 1)) * (w - 8) + 4
  const y = (v: number) => h - 4 - (v / 100) * (h - 8)
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values[values.length - 1]
  const first = values[0]
  return (
    <div className="flex items-end gap-3">
      <span className="font-display text-3xl leading-none">{last}%</span>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-40" aria-label={`Chance over the chapters: ${values.join(', ')}`}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className={last < first ? 'text-destructive' : 'text-success'} />
        <circle cx={x(values.length - 1)} cy={y(last)} r="3" className={cn('fill-current', last < first ? 'text-destructive' : 'text-success')} />
      </svg>
    </div>
  )
}

// --- making or changing a story ------------------------------------------------------------------------------------

const PACINGS: Pacing[] = ['brisk', 'steady', 'slow']

/** A new story, or the details of one: its ending, stakes, chance, pace, and its checkpoints (one per line, or from a template). */
export function StoryDialog({ open, onOpenChange, story, onSaved, start }: { open: boolean; onOpenChange: (o: boolean) => void; story?: Story; onSaved?: (s: Story) => void; /** A new story that begins tied to a record (from a case, a project or a client). */ start?: { workspace: WorkspaceId; links: EntityRef[]; title?: string } }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">{open && <StoryForm story={story} start={start} onSaved={onSaved} onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

/** The form itself, started afresh each time the dialog opens (from the story when there is one). */
function StoryForm({ story, start, onSaved, onClose }: { story?: Story; start?: { workspace: WorkspaceId; links: EntityRef[]; title?: string }; onSaved?: (s: Story) => void; onClose: () => void }) {
  const { scope } = useWorkspaceFilter()
  const templates = useArcTemplates()
  const { run, busy } = useStoryAction()
  const [title, setTitle] = useState(story?.title ?? start?.title ?? '')
  const [workspace, setWorkspace] = useState<WorkspaceId>(story?.workspace ?? start?.workspace ?? (scope === 'all' ? 'personal' : scope))
  const [links, setLinks] = useState<EntityRef[]>(story?.links ?? start?.links ?? [])
  const [ending, setEnding] = useState(story?.ending ?? '')
  const [stakes, setStakes] = useState(String(story?.stakes ?? 3))
  const [chance, setChance] = useState(story?.chance !== undefined ? String(story.chance) : '')
  const [pacing, setPacing] = useState<Pacing>(story?.pacing ?? 'steady')
  const [lines, setLines] = useState('')
  const [asTemplate, setAsTemplate] = useState('')
  // Stakes, chance and pace have sensible defaults, so a new story asks for them only if you want to.
  const [more, setMore] = useState(!!story)

  const offered = (templates.data ?? []).filter((t) => t.workspace === workspace)

  async function save() {
    const chanceNum = chance.trim() === '' ? undefined : Math.max(0, Math.min(100, Math.round(Number(chance))))
    const added = checkpointsFromLines(lines, newId)
    const next: Story = {
      ...(story ?? { id: newId(), state: 'writing', checkpoints: [], bible: [], links: [] }),
      title: title.trim(),
      workspace,
      ending: ending.trim(),
      stakes: Number(stakes),
      chance: chanceNum,
      pacing,
      links: linksAllowed(links, workspace),
      checkpoints: [...(story?.checkpoints ?? []), ...added],
    } as Story
    const saved = await run((s) => s.stories.saveStory(next), { success: story ? 'Saved' : 'Story started', failure: 'Couldn’t save the story' })
    if (!saved) return
    if (asTemplate.trim() && next.checkpoints.length) {
      await run((s) => s.stories.saveArcTemplate({ id: newId(), name: asTemplate.trim(), workspace, checkpoints: next.checkpoints.map((c) => c.title), ending: next.ending }))
    }
    onSaved?.(saved)
    onClose()
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">{story ? 'The story' : 'A new story'}</DialogTitle>
          <DialogDescription>Write the ending first: it’s what you’re working towards, and how you’ll know the story is over.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Field label="Title" htmlFor="story-title">
            <Input id="story-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Home loan" required autoFocus />
          </Field>
          {!story && !start && (
            <Field label="Workspace" htmlFor="story-ws">
              <WorkspacePicker id="story-ws" value={workspace} onChange={(ws) => (setWorkspace(ws), setLinks((l) => linksAllowed(l, ws)))} only={[...WORKSPACE_IDS]} />
            </Field>
          )}
          {LINKS_BY_WORKSPACE[workspace].length > 0 && (
            <Field label={LINKS_BY_WORKSPACE[workspace].includes('case') ? 'Cases it covers' : 'Projects and clients it covers'} hint="Optional. A story can cover several; its timeline then shows their recorded hearings, and they list the story.">
              <LinkedRecords workspace={workspace} value={links} onChange={setLinks} />
            </Field>
          )}
          <Field label="The ending you want" htmlFor="story-ending">
            <Textarea id="story-ending" value={ending} onChange={(e) => setEnding(e.target.value)} placeholder="Disbursed before March, at 9% or less" rows={2} className="font-display text-lg" />
          </Field>
          <Field label={story ? 'Add checkpoints' : 'Checkpoints'} htmlFor="story-cps" hint="One per line, in order. Plot points, not tasks: “Documents in”, “Sanction letter”">
            {offered.length > 0 && (
              <NativeSelect
                aria-label="Start from a template"
                value=""
                onChange={(e) => {
                  const t = offered.find((x) => x.id === e.target.value)
                  if (!t) return
                  setLines(t.checkpoints.join('\n'))
                  if (!ending && t.ending) setEnding(t.ending)
                }}
                className="mb-2"
              >
                <option value="">Start from one of your arcs…</option>
                {offered.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.checkpoints.length})
                  </option>
                ))}
              </NativeSelect>
            )}
            <Textarea id="story-cps" value={lines} onChange={(e) => setLines(e.target.value)} rows={4} placeholder={'Pick a lender\nDocuments in\nBank verification\nSanction letter'} />
          </Field>
          <button type="button" className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={more} onClick={() => setMore((m) => !m)}>
            {more ? 'Fewer options' : `More options: stakes ${stakes}, ${PACING_LABEL[pacing].split(' · ')[1]}${chance ? `, ${chance}% chance` : ''}`}
          </button>
          {more && (
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Stakes" hint="How much rides on it">
                  <Segmented label="Stakes" value={stakes} onChange={setStakes} options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))} />
                </Field>
                <Field label="Chance of the ending" htmlFor="story-chance" hint="0–100, your read">
                  <Input id="story-chance" type="number" min={0} max={100} value={chance} onChange={(e) => setChance(e.target.value)} placeholder="60" />
                </Field>
              </div>
              <Field label="Pace" hint="How quiet is too quiet: the editor nudges when a story falls behind it">
                <Segmented label="Pace" value={pacing} onChange={setPacing} options={PACINGS.map((p) => ({ value: p, label: PACING_LABEL[p] }))} />
              </Field>
              {(lines.trim() || (story?.checkpoints.length ?? 0) > 0) && (
                <Field label="Save this arc as a template" htmlFor="story-template" hint="Optional: a name, and the checkpoints are offered for new stories in this workspace">
                  <Input id="story-template" value={asTemplate} onChange={(e) => setAsTemplate(e.target.value)} placeholder="Loan" />
                </Field>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy && <Spinner size="xs" tone="current" decorative />} {story ? 'Save' : 'Start the story'}
            </Button>
          </DialogFooter>
        </form>
    </>
  )
}


// --- what a story covers ---------------------------------------------------------------------------------------------

/** Picks the cases, projects or clients a story covers, from those the workspace has. */
export function LinkedRecords({ workspace, value, onChange }: { workspace: WorkspaceId; value: EntityRef[]; onChange: (v: EntityRef[]) => void }) {
  const options = useLinkables(workspace)
  const chosen = value.map((r) => options.find((o) => sameRef(o.ref, r)) ?? { ref: r, kind: r.kind, label: 'A record that’s gone' })
  const left = options.filter((o) => !value.some((r) => sameRef(r, o.ref)))
  return (
    <div className="grid gap-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((o) => (
            <li key={`${o.ref.kind}:${o.ref.id}`} className="inline-flex max-w-full items-center gap-1 rounded-lg border bg-muted/40 py-0.5 pr-1 pl-2 text-xs">
              <span className="text-muted-foreground">{o.kind}</span>
              <span className="truncate">{o.label}</span>
              <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Stop covering ${o.label}`} onClick={() => onChange(toggleLink(value, o.ref))}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <NativeSelect
        aria-label="Cover another record"
        value=""
        onChange={(e) => {
          const [kind, id] = e.target.value.split(':')
          if (kind && id) onChange(toggleLink(value, { kind, id } as EntityRef))
        }}
        disabled={left.length === 0}
      >
        <option value="">{options.length === 0 ? 'Nothing here to cover yet' : left.length === 0 ? 'Everything is covered' : 'Cover another…'}</option>
        {left.map((o) => (
          <option key={`${o.ref.kind}:${o.ref.id}`} value={`${o.ref.kind}:${o.ref.id}`}>
            {o.kind} · {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
