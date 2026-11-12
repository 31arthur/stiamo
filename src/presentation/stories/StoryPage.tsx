import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowDown, ArrowUp, Check, CircleSlash, Feather, Flag, Gavel, Hourglass, Pencil, Plus, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Chapter, Checkpoint, CheckpointStatus, DraftResult, Story, Timeline } from '@/domain/stories/Stories'
import { PACING_LABEL, moveCheckpoint } from '@/domain/stories/Stories'
import { BackButton } from '@/presentation/components/BackButton'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { DateInput, NativeSelect } from '@/presentation/components/form'
import { Section } from '@/presentation/components/layout'
import { DetailSkeleton } from '@/presentation/components/loading'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { CallLink } from '@/presentation/contacts/CallLink'
import { useServices } from '@/presentation/app/services'
import { useToday } from '@/presentation/data/hooks'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { toast } from '@/presentation/notifications/toast'
import { Link, Navigate, useNavigate } from '@/presentation/routing'
import { ArcTrack, BeatChip, ChanceTrend, StoryDialog } from './parts'
import { useStoryAction, useTimeline } from './useStories'

const newId = () => crypto.randomUUID()

export function StoryPage() {
  const { id } = useParams<{ id: string }>()
  const timeline = useTimeline(id)
  if (timeline.isLoading) return <DetailSkeleton />
  if (!timeline.data) return <Navigate to="/stories" replace />
  return <StoryView key={timeline.data.story.id} t={timeline.data} />
}

function StoryView({ t }: { t: Timeline }) {
  const s = t.story
  useDocumentTitle(s.title)
  const navigate = useNavigate()
  const { run } = useStoryAction()
  const [editing, setEditing] = useState(false)
  const save = (next: Partial<Story>, success = 'Saved') => run((x) => x.stories.saveStory({ ...s, ...next }), { success, failure: 'Couldn’t save the story' })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback="/stories" />
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          {s.state === 'writing' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => void save({ state: 'resting' }, 'Resting: no questions until you write in it')}>
                <Hourglass /> Rest it
              </Button>
              <Button variant="outline" size="sm" onClick={() => void save({ state: 'ended', endedOn: format(new Date(), 'yyyy-MM-dd') }, 'The End')}>
                <Flag /> The End
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void save({ state: 'writing', endedOn: undefined }, 'Back to writing it')}>
              <Feather /> Write in it again
            </Button>
          )}
          <ConfirmDelete
            what={`“${s.title}”, with its ${t.entries.filter((e) => e.kind === 'chapter').length} chapters. The tasks and calls it left stay, and so do the people.`}
            onConfirm={async () => {
              await run((x) => x.stories.removeStory(s.id), { success: 'Story deleted' })
              navigate('/stories')
            }}
          />
        </div>
      </div>

      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <WorkspaceBadge ws={s.workspace} />
          <span className="rounded-md bg-muted px-2 py-0.5 font-medium capitalize">{s.state}</span>
          <span className="rounded-md bg-muted px-2 py-0.5">Stakes {s.stakes}{s.stakesAmount ? ` · ${s.stakesAmount}` : ''}</span>
          <span className="rounded-md bg-muted px-2 py-0.5">{PACING_LABEL[s.pacing]}</span>
        </div>
        <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{s.title}</h1>
        {s.ending && <p className="font-display text-xl text-muted-foreground italic">The ending: {s.ending}</p>}
      </header>

      <Section title="The arc" description={t.here ? `Now at “${t.here.title}”${t.progress !== null ? ` · ${Math.round(t.progress * 100)}% of the way` : ''}` : undefined}>
        <div className="p-4">
          <ArcTrack checkpoints={s.checkpoints} ending={s.ending} />
          <ArcEditor story={s} />
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          <Manuscript t={t} />
          <WritingDesk story={s} next={t.entries.filter((e) => e.kind === 'chapter').length + 1} />
        </div>
        <aside className="grid content-start gap-4">
          <WhereItStands t={t} onSave={save} />
          <OpenWork t={t} />
          <CastPanel t={t} />
          <Threads t={t} />
          <Bible story={s} onSave={save} />
        </aside>
      </div>

      <StoryDialog open={editing} onOpenChange={setEditing} story={s} />
    </>
  )
}

// --- the arc, edited -----------------------------------------------------------------------------------------------

function ArcEditor({ story }: { story: Story }) {
  const [open, setOpen] = useState(false)
  const [cps, setCps] = useState<Checkpoint[]>(story.checkpoints)
  const [draft, setDraft] = useState('')
  const { run, busy } = useStoryAction()
  const set = (id: string, patch: Partial<Checkpoint>) => setCps((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  if (!open)
    return (
      <Button variant="ghost" size="xs" className="mt-2" onClick={() => (setCps(story.checkpoints), setOpen(true))}>
        <Pencil /> Change the checkpoints
      </Button>
    )
  return (
    <div className="mt-3 grid gap-2">
      <ul className="grid gap-1.5">
        {cps.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-1.5">
            <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <Input value={c.title} onChange={(e) => set(c.id, { title: e.target.value })} className="h-8 min-w-40 flex-1" aria-label={`Checkpoint ${i + 1}`} />
            <NativeSelect value={c.status} onChange={(e) => set(c.id, { status: e.target.value as CheckpointStatus })} className="h-8 w-28" aria-label="Status">
              <option value="ahead">Ahead</option>
              <option value="reached">Reached</option>
              <option value="skipped">Skipped</option>
            </NativeSelect>
            <div className="w-36">
              <DateInput value={c.targetDate} onChange={(d) => set(c.id, { targetDate: d })} aria-label="Target date" />
            </div>
            <Button size="icon-xs" variant="ghost" aria-label="Move up" onClick={() => setCps((l) => moveCheckpoint(l, c.id, -1))}>
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Move down" onClick={() => setCps((l) => moveCheckpoint(l, c.id, 1))}>
              <ArrowDown />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => setCps((l) => l.filter((x) => x.id !== c.id))}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          setCps((l) => [...l, { id: newId(), title: draft.trim(), status: 'ahead', addedBy: 'you' }])
          setDraft('')
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a checkpoint" className="h-8" />
        <Button type="submit" size="sm" variant="outline">
          <Plus /> Add
        </Button>
      </form>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || cps.some((c) => !c.title.trim())} onClick={() => void run((x) => x.stories.saveStory({ ...story, checkpoints: cps }), { success: 'Checkpoints saved' }).then((ok) => ok && setOpen(false))}>
          {busy ? <Spinner size="xs" tone="current" decorative /> : <Check />} Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// --- the chapters ------------------------------------------------------------------------------------------------------

function Manuscript({ t }: { t: Timeline }) {
  if (!t.entries.length)
    return (
      <Section title="The story so far">
        <p className="p-4 font-display text-lg text-muted-foreground italic">Nothing written yet. Chapter one starts below.</p>
      </Section>
    )
  return (
    <Section title="The story so far" description={`${t.entries.filter((e) => e.kind === 'chapter').length} chapters`} bodyClassName="divide-y">
      {t.entries.map((e) =>
        e.chapter ? (
          <ChapterView key={e.chapter.id} c={e.chapter} />
        ) : e.hearing ? (
          <article key={e.hearing.id} className="flex gap-3 p-4">
            <Gavel className="mt-1 size-4 shrink-0 text-ws-sb" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Hearing · {format(parseISO(e.date), 'd MMM yyyy')}</div>
              <div className="font-medium">{e.hearing.purpose}</div>
              {e.hearing.summary && <p className="mt-1 text-sm">{e.hearing.summary}</p>}
              {e.hearing.order && <p className="mt-1 text-sm text-muted-foreground">Order: {e.hearing.order}</p>}
            </div>
          </article>
        ) : null,
      )}
    </Section>
  )
}

function ChapterView({ c }: { c: Chapter }) {
  const notes = c.notes.filter((n) => n.kind !== 'beat')
  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[1fr_240px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold tracking-widest uppercase">Chapter {c.number}</span>
          <span>{format(parseISO(c.date), 'EEE d MMM yyyy')}</span>
          <BeatChip beat={c.beat} />
          {c.chanceAfter !== undefined && <span className="tabular-nums">{c.chanceAfter}%</span>}
        </div>
        {c.title && <h3 className="mt-1 font-display text-2xl leading-tight">{c.title}</h3>}
        <p className="mt-2 font-display text-lg leading-relaxed whitespace-pre-wrap">{c.prose}</p>
        {c.cliffhanger && <p className={cn('mt-2 text-sm italic', c.cliffhanger.answeredIn ? 'text-muted-foreground line-through' : 'text-ws-media')}>{c.cliffhanger.question}</p>}
      </div>
      {notes.length > 0 && (
        <ul className="grid content-start gap-2 border-l pl-3 text-xs" aria-label="Margin notes">
          {notes.map((n, i) => (
            <li key={i} className="grid gap-0.5">
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{n.kind}</span>
              <span>{n.text}</span>
              {n.quote && <span className="font-display text-sm text-muted-foreground italic">“{n.quote}”</span>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** Where the next chapter is written. Your words are kept as you write them; the margin notes are read from them for you to approve. */
function WritingDesk({ story, next }: { story: Story; next: number }) {
  const { agent } = useServices()
  const { run, busy, refresh } = useStoryAction()
  const today = useToday()
  const [prose, setProse] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string | undefined>(undefined)
  const [card, setCard] = useState<Extract<DraftResult, { proposed: true }> | null>(null)
  const [deciding, setDeciding] = useState(false)

  if (story.state !== 'writing') return null

  async function readNotes() {
    const out = await run((x) => x.stories.draftChapter({ prose, story: story.id, title: title || undefined, date }), { failure: 'Couldn’t read the margin notes' })
    if (out && 'proposed' in out) setCard(out)
  }

  async function decide(approve: boolean) {
    if (!card) return
    setDeciding(true)
    try {
      await (approve ? agent.approveProposal(card.id) : agent.dropProposal(card.id))
      if (approve) {
        toast.success(`Chapter ${next} written`)
        setProse('')
        setTitle('')
        setDate(undefined)
      }
      setCard(null)
      await refresh()
    } catch (e) {
      toast.error('Couldn’t save it', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setDeciding(false)
    }
  }

  async function keepAsWritten() {
    const out = await run((x) => x.stories.writeChapter(story.id, { prose, title: title || undefined, date }), { success: `Chapter ${next} written`, failure: 'Couldn’t save the chapter' })
    if (out) {
      setProse('')
      setTitle('')
      setDate(undefined)
    }
  }

  return (
    <Section title={`Chapter ${next}`} description="Write it the way you’d write a novel. Your words are kept exactly as written.">
      <div className="grid gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, if you like" className="font-display text-lg" aria-label="Chapter title" />
          <DateInput value={date} onChange={setDate} aria-label="When it happened" />
        </div>
        <Textarea
          value={prose}
          onChange={(e) => setProse(e.target.value)}
          rows={8}
          placeholder="The agent called at seven, sorry as always…"
          className="min-h-48 resize-y bg-[oklch(0.985_0.006_85)] font-display text-xl leading-relaxed dark:bg-input/20"
          aria-label="The chapter"
          disabled={!!card}
        />
        {!card ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy || !prose.trim()} onClick={() => void readNotes()}>
              {busy ? <Spinner size="xs" tone="current" decorative /> : <Sparkles />} Read the margin notes
            </Button>
            <Button variant="ghost" disabled={busy || !prose.trim()} onClick={() => void keepAsWritten()}>
              Keep it as written, no notes
            </Button>
            <span className="text-xs text-muted-foreground">{date && date !== today ? `Dated ${date}` : 'Dated today'}</span>
          </div>
        ) : (
          <div className="grid gap-2 rounded-xl border bg-card p-3">
            <div className="text-sm font-medium">{card.title}</div>
            <ul className="grid gap-1 text-sm">
              {card.lines.map((l, i) => (
                <li key={i} className={cn(l.startsWith('Your words') || l.startsWith('Left out') || l.startsWith('No margin') ? 'text-xs text-muted-foreground' : '')}>
                  {l}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" disabled={deciding} onClick={() => void decide(true)}>
                {deciding ? <Spinner size="xs" tone="current" decorative /> : <Check />} Keep all
              </Button>
              <Button size="sm" variant="ghost" disabled={deciding} onClick={() => void decide(false)}>
                <CircleSlash /> Not these notes
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">“Not these notes” drops the card and keeps your words here, to change or to keep as written.</p>
          </div>
        )}
      </div>
    </Section>
  )
}

// --- around the story -------------------------------------------------------------------------------------------------

function WhereItStands({ t, onSave }: { t: Timeline; onSave: (next: Partial<Story>, success?: string) => Promise<unknown> }) {
  const s = t.story
  const [on, setOn] = useState(s.waitingOn?.on ?? '')
  const [until, setUntil] = useState<string | undefined>(s.waitingOn?.until)
  const [editing, setEditing] = useState(false)
  return (
    <Section title="Where it stands">
      <div className="grid gap-4 p-4">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Chance of the ending</div>
          <ChanceTrend points={t.chanceTrend} current={s.chance} />
        </div>
        <div className="grid gap-1.5">
          <div className="text-xs text-muted-foreground">Waiting on</div>
          {!editing ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{s.waitingOn ? `${s.waitingOn.on}${s.waitingOn.until ? `, until ${format(parseISO(s.waitingOn.until), 'd MMM')}` : ''}` : 'Nothing: it’s yours to move'}</span>
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil /> Change
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Input value={on} onChange={(e) => setOn(e.target.value)} placeholder="The court, HR, the client…" />
              <DateInput value={until} onChange={setUntil} aria-label="Until" />
              <div className="flex gap-2">
                <Button size="xs" onClick={() => void onSave({ waitingOn: on.trim() ? { on: on.trim(), until } : undefined }).then(() => setEditing(false))}>
                  Save
                </Button>
                {s.waitingOn && (
                  <Button size="xs" variant="ghost" onClick={() => void onSave({ waitingOn: undefined }, 'No longer waiting').then(() => setEditing(false))}>
                    Not waiting any more
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

function OpenWork({ t }: { t: Timeline }) {
  const n = t.openTasks.length + t.openFollowUps.length
  return (
    <Section title="Work it left" description={n ? `${n} open` : 'Nothing open'} bodyClassName="p-2">
      {n === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">Chapters that leave work put it here (and on your planner).</p>
      ) : (
        <ul className="grid gap-1">
          {t.openFollowUps.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
              <span className="min-w-0">
                <span className="block truncate">{f.title}</span>
                <span className="text-xs text-muted-foreground capitalize">{f.channel}{f.due ? ` · ${format(parseISO(f.due.date), 'EEE d MMM')}` : ''}</span>
              </span>
              {f.contact && <CallLink contact={f.contact} />}
            </li>
          ))}
          {t.openTasks.map((x) => (
            <li key={x.id} className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
              <span className="block truncate">{x.title}</span>
              {x.dueDate && <span className="text-xs text-muted-foreground">Due {format(parseISO(x.dueDate), 'EEE d MMM')}</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function CastPanel({ t }: { t: Timeline }) {
  const { run, busy } = useStoryAction()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [part, setPart] = useState('')
  return (
    <Section
      title="The cast"
      description={`${t.cast.length} ${t.cast.length === 1 ? 'person' : 'people'}`}
      actions={
        <Button size="xs" variant="ghost" onClick={() => setAdding((a) => !a)}>
          <UserPlus /> Add
        </Button>
      }
      bodyClassName="p-2"
    >
      {adding && (
        <form
          className="mb-2 grid gap-2 rounded-xl border p-2"
          onSubmit={(e) => {
            e.preventDefault()
            void run((x) => x.stories.joinCast({ name: name.trim(), phones: phone.trim() ? [phone.trim()] : [], storyId: t.story.id, part: part.trim() || undefined }), { success: 'In the cast' }).then((ok) => {
              if (!ok) return
              setName('')
              setPhone('')
              setPart('')
              setAdding(false)
            })
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (someone already known by it is reused)" />
          <Input value={part} onChange={(e) => setPart(e.target.value)} placeholder="Their part: decider, other side, the agent…" />
          <Button size="sm" type="submit" disabled={busy || !name.trim()}>
            Add to the story
          </Button>
        </form>
      )}
      {t.cast.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">People named in chapters join the cast when you keep the notes.</p>
      ) : (
        <ul className="grid gap-1">
          {t.cast.map(({ character: c, part: p }) => (
            <li key={p.id}>
              <Link to={`/cast/${c.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{c.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[p.part, p.knownAs.length ? `“${p.knownAs.join('”, “')}”` : ''].filter(Boolean).join(' · ') || 'Part not said'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Threads({ t }: { t: Timeline }) {
  if (!t.hunches.length && !t.cliffhangers.length) return null
  return (
    <Section title="Loose threads">
      <ul className="grid gap-2 p-4 text-sm">
        {t.cliffhangers.map((c) => (
          <li key={c.chapterId}>
            <span className="text-[10px] font-semibold tracking-widest text-ws-media uppercase">Cliffhanger · ch. {c.number}</span>
            <p className="font-display text-base italic">{c.question}</p>
          </li>
        ))}
        {t.hunches.map((h) => (
          <li key={h.id}>
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Hunch · ch. {h.number}</span>
            <p className="font-display text-base italic">{h.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Bible({ story, onSave }: { story: Story; onSave: (next: Partial<Story>, success?: string) => Promise<unknown> }) {
  const [rows, setRows] = useState(story.bible)
  const [dirty, setDirty] = useState(false)
  const set = (i: number, patch: Partial<{ key: string; value: string }>) => (setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x))), setDirty(true))
  return (
    <Section title="Story bible" description="Facts it needs remembered: amounts, file numbers, names.">
      <div className="grid gap-1.5 p-3">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1.5">
            <Input value={r.key} onChange={(e) => set(i, { key: e.target.value })} placeholder="Amount" className="h-8 w-28" aria-label="Fact" />
            <Input value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="₹25L" className="h-8 flex-1" aria-label="Value" />
            <Button size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => (setRows((x) => x.filter((_, j) => j !== i)), setDirty(true))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="xs" variant="ghost" onClick={() => setRows((r) => [...r, { key: '', value: '' }])}>
            <Plus /> A fact
          </Button>
          {dirty && (
            <Button size="xs" onClick={() => void onSave({ bible: rows.filter((r) => r.key.trim()) }).then(() => setDirty(false))}>
              Save
            </Button>
          )}
        </div>
      </div>
    </Section>
  )
}


