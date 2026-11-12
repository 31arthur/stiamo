import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Combine, Mail, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { LENSES, STANCE_LABEL, SWAY_LABEL, phrase, sketchOf } from '@/domain/stories/Stories'
import type { Character, CharacterView, Evidence, LensView, Part, Profile, Stance, Sway } from '@/domain/stories/Stories'
import { BackButton } from '@/presentation/components/BackButton'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { Field, NativeSelect } from '@/presentation/components/form'
import { Section } from '@/presentation/components/layout'
import { DetailSkeleton } from '@/presentation/components/loading'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { CallLink } from '@/presentation/contacts/CallLink'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { Link, Navigate, useNavigate } from '@/presentation/routing'
import { useCharacterView, useCharacters, useEvidence, useStoryAction } from './useStories'

export function CharacterPage() {
  const { id } = useParams<{ id: string }>()
  const view = useCharacterView(id)
  if (view.isLoading) return <DetailSkeleton />
  if (!view.data) return <Navigate to="/cast" replace />
  return <CharacterDetail key={view.data.character.id} v={view.data} />
}

const CONF_TONE = { high: 'bg-success/12 text-success', medium: 'bg-primary/10 text-primary', low: 'bg-muted text-muted-foreground' }

function CharacterDetail({ v }: { v: CharacterView }) {
  const c = v.character
  useDocumentTitle(c.name)
  const navigate = useNavigate()
  const { run, busy } = useStoryAction()
  const evidence = (useEvidence().data ?? []).filter((e) => e.characterId === c.id).sort((a, b) => b.date.localeCompare(a.date))
  const [editing, setEditing] = useState(false)
  const [merging, setMerging] = useState(false)
  const p = c.profile

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback="/cast" />
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void run((x) => x.stories.profile(c.id), { success: 'Worked out again from the evidence' })}>
            <RefreshCw /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMerging(true)}>
            <Combine /> Same person as…
          </Button>
          <ConfirmDelete
            what={`${c.name}, with their parts, scenes and everything known about them. The stories stay.`}
            onConfirm={async () => {
              await run((x) => x.stories.removeCharacter(c.id), { success: 'Removed from the cast' })
              navigate('/cast')
            }}
          />
        </div>
      </div>

      <header className="flex flex-wrap items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted font-display text-3xl">{c.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{c.name}</h1>
          {(c.title || c.organisation) && <p className="text-muted-foreground">{[c.title, c.organisation].filter(Boolean).join(', ')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {c.phones.map((ph) => (
              <CallLink key={ph} contact={`${c.name} · ${ph}`} />
            ))}
            {c.emails.map((m) => (
              <Button key={m} variant="outline" size="sm" render={<a href={`mailto:${m}`} />}>
                <Mail /> {m}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <p className="max-w-3xl font-display text-2xl leading-snug">{sketchOf(c.name, p)}</p>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <Section title="What is known" description="Added up from scenes and your answers. Low means there isn't enough yet; a conflict is shown, not averaged away.">
            <ul className="grid gap-3 p-4">
              {LENSES.map((l) => (
                <LensRow key={l.id} label={l.label} asks={l.asks} view={p?.lenses[l.id]} />
              ))}
              {(p?.custom ?? []).map((x) => (
                <li key={x.id} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{x.name}</span>
                    <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', CONF_TONE[x.confidence])}>{x.confidence}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn(x.label === 'a' && 'font-semibold text-foreground')}>{x.poleA}</span>
                    <span className="relative h-1.5 flex-1 rounded-full bg-muted">
                      <span className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary" style={{ left: x.label === 'a' ? '8%' : x.label === 'b' ? '88%' : '48%' }} />
                    </span>
                    <span className={cn(x.label === 'b' && 'font-semibold text-foreground')}>{x.poleB}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Scenes" description="What they did, story by story, in your words." bodyClassName="divide-y">
            {v.scenes.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No scenes yet. They come from the chapters you write.</p>
            ) : (
              v.scenes.map((s) => (
                <article key={s.id} className="grid gap-1 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <WorkspaceDot ws={s.workspace} />
                    <span>{format(parseISO(s.date), 'd MMM yyyy')}</span>
                    <span>· {v.parts.find((x) => x.storyId === s.storyId)?.story?.title ?? ''}</span>
                  </div>
                  <div className="text-sm">{s.text}</div>
                  {s.quote && <div className="font-display text-base text-muted-foreground italic">“{s.quote}”</div>}
                </article>
              ))
            )}
          </Section>
          <EvidenceList items={evidence} />
        </div>
        <aside className="grid content-start gap-4">
          <TrackRecord p={p} />
          <Parts parts={v.parts} />
        </aside>
      </div>

      <EditCharacter open={editing} onOpenChange={setEditing} c={c} />
      <MergeInto open={merging} onOpenChange={setMerging} c={c} />
    </>
  )
}

function LensRow({ label, asks, view }: { label: string; asks: string; view?: LensView }) {
  if (!view)
    return (
      <li className="flex items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{label}</span> <span className="text-xs text-muted-foreground">· {asks}</span>
        </span>
        <span className="text-xs text-muted-foreground">Not known yet</span>
      </li>
    )
  const total = Object.values(view.labels).reduce((a, b) => a + b, 0) || 1
  return (
    <li className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{label}</span> <span className="text-muted-foreground">· {phrase(view.label)}{view.also ? ` and ${phrase(view.also)}` : ''}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {view.evidence} piece{view.evidence === 1 ? '' : 's'}
          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', CONF_TONE[view.confidence])}>{view.conflict ? 'in conflict' : view.confidence}</span>
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {Object.entries(view.labels).map(([k, w], i) => (
          <span key={k} title={`${phrase(k)}: ${Math.round((w / total) * 100)}%`} style={{ width: `${(w / total) * 100}%` }} className={cn(i === 0 ? 'bg-primary' : i === 1 ? 'bg-primary/50' : 'bg-primary/25')} />
        ))}
      </div>
      {view.conflict && <p className="text-xs text-warning">Both “{phrase(view.conflict[0])}” and “{phrase(view.conflict[1])}”: the interviewer will ask which is closer now.</p>}
    </li>
  )
}

function TrackRecord({ p }: { p?: Profile }) {
  const tr = p?.trackRecord
  return (
    <Section title="Track record" description="Counted from your calls with them, never guessed.">
      <div className="grid gap-3 p-4 text-sm">
        {!tr ? (
          <p className="text-muted-foreground">No calls logged with them yet.</p>
        ) : (
          <>
            {Object.entries(tr.answerRate).map(([ch, r]) => (
              <div key={ch} className="grid gap-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{ch}</span>
                  <span className="tabular-nums">answers {Math.round(r * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${r * 100}%` }} />
                </div>
              </div>
            ))}
            {tr.bestHours.length > 0 && <p className="text-xs">Best: {tr.bestHours.join(' or ')}</p>}
            {tr.promises && (
              <p className="text-xs">
                Kept {tr.promises.kept} of {tr.promises.of} promised dates{tr.promises.avgDaysLate ? `, about ${tr.promises.avgDaysLate} days late otherwise` : ''}.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">From {tr.tries} tries.</p>
          </>
        )}
        {p?.reads && (
          <div className="grid gap-0.5 border-t pt-3 text-xs">
            <span className="font-medium">How the reads of them went</span>
            {p.reads.you && <span>Your guesses: {p.reads.you.right} of {p.reads.you.of} right</span>}
            {p.reads.model && <span>The model’s: {p.reads.model.right} of {p.reads.model.of} right</span>}
          </div>
        )}
      </div>
    </Section>
  )
}

function Parts({ parts }: { parts: CharacterView['parts'] }) {
  const { run } = useStoryAction()
  return (
    <Section title="Their parts" description="The part they play in each story." bodyClassName="p-2">
      {parts.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">Not in a story yet.</p>
      ) : (
        <ul className="grid gap-2">
          {parts.map(({ story, ...p }) => (
            <li key={p.id} className="grid gap-2 rounded-xl border p-3">
              {story ? (
                <Link to={`/stories/${story.id}`} className="flex items-center gap-2 text-sm font-medium hover:underline">
                  <WorkspaceDot ws={story.workspace} /> {story.title}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">A story that’s gone</span>
              )}
              <PartFields part={p} onSave={(next) => void run((x) => x.stories.saveCharacterPart(next), { success: 'Saved' })} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function PartFields({ part, onSave }: { part: Part; onSave: (p: Part) => void }) {
  const [name, setName] = useState(part.part)
  return (
    <div className="grid gap-1.5">
      <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== part.part && onSave({ ...part, part: name })} placeholder="Their part: decider, other side…" className="h-8" aria-label="Their part" />
      <div className="flex gap-1.5">
        <NativeSelect value={part.stance ?? ''} onChange={(e) => onSave({ ...part, stance: (e.target.value || undefined) as Stance | undefined })} className="h-8 flex-1" aria-label="Stance">
          <option value="">Stance not said</option>
          {(Object.keys(STANCE_LABEL) as Stance[]).map((s) => (
            <option key={s} value={s}>
              {STANCE_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={part.sway ?? ''} onChange={(e) => onSave({ ...part, sway: (e.target.value || undefined) as Sway | undefined })} className="h-8 flex-1" aria-label="Sway">
          <option value="">Sway not said</option>
          {(Object.keys(SWAY_LABEL) as Sway[]).map((s) => (
            <option key={s} value={s}>
              {SWAY_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {part.knownAs.length > 0 && <span className="text-[11px] text-muted-foreground">Called “{part.knownAs.join('”, “')}” there</span>}
    </div>
  )
}

const SOURCE_LABEL: Record<string, string> = { scene: 'from a scene', debrief: 'your debrief', quick_tap: 'your answer', check: 'you checked', sheet: 'character sheet', what_would: 'a guess', compare: 'a comparison', why: 'why', moment: 'a moment' }

function EvidenceList({ items }: { items: Evidence[] }) {
  if (!items.length) return null
  return (
    <Section title="The evidence" description={`${items.length} pieces. Each label points at where it came from.`} bodyClassName="divide-y">
      {items.slice(0, 40).map((e) => (
        <div key={e.id} className="grid gap-0.5 px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{format(parseISO(e.date), 'd MMM yyyy')}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5">{e.lens.startsWith('custom:') ? 'your lens' : e.lens.replaceAll('_', ' ')}</span>
            <span>{SOURCE_LABEL[e.method] ?? e.method}</span>
            {e.source === 'prediction' && <span className={cn('rounded-md px-1.5 py-0.5', e.verdict === 'right' ? 'bg-success/12 text-success' : e.verdict === 'wrong' ? 'bg-destructive/10 text-destructive' : 'bg-muted')}>{e.predictedBy === 'model' ? 'model’s guess' : 'your guess'} · {e.verdict}</span>}
          </div>
          <div>{phrase(e.label)}</div>
          {e.quote && <div className="font-display text-base text-muted-foreground italic">“{e.quote}”</div>}
          {e.about && <div className="text-xs text-muted-foreground">About: {e.about}</div>}
        </div>
      ))}
    </Section>
  )
}

function EditCharacter({ open, onOpenChange, c }: { open: boolean; onOpenChange: (o: boolean) => void; c: Character }) {
  const { run, busy } = useStoryAction()
  const [name, setName] = useState(c.name)
  const [title, setTitle] = useState(c.title ?? '')
  const [org, setOrg] = useState(c.organisation ?? '')
  const [phones, setPhones] = useState(c.phones.join(', '))
  const [emails, setEmails] = useState(c.emails.join(', '))
  const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Who they are</DialogTitle>
          <DialogDescription>This travels with them into every story and workspace they’re part of.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run((x) => x.stories.saveCharacter({ ...c, name: name.trim(), title: title.trim() || undefined, organisation: org.trim() || undefined, phones: list(phones), emails: list(emails) }), { success: 'Saved', failure: 'Couldn’t save' }).then((ok) => ok && onOpenChange(false))
          }}
        >
          <Field label="Name" htmlFor="c-name">
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" htmlFor="c-title">
              <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Organisation" htmlFor="c-org">
              <Input id="c-org" value={org} onChange={(e) => setOrg(e.target.value)} />
            </Field>
          </div>
          <Field label="Phones" htmlFor="c-phones" hint="Separated by commas">
            <Input id="c-phones" value={phones} onChange={(e) => setPhones(e.target.value)} />
          </Field>
          <Field label="Emails" htmlFor="c-emails" hint="Separated by commas">
            <Input id="c-emails" value={emails} onChange={(e) => setEmails(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Spinner size="xs" tone="current" decorative />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MergeInto({ open, onOpenChange, c }: { open: boolean; onOpenChange: (o: boolean) => void; c: Character }) {
  const { items } = useCharacters()
  const { run, busy } = useStoryAction()
  const navigate = useNavigate()
  const [into, setInto] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">The same person</DialogTitle>
          <DialogDescription>If {c.name} is someone already in the cast, everything of theirs (parts, scenes, evidence, calls and numbers) moves across, and this record goes.</DialogDescription>
        </DialogHeader>
        <NativeSelect value={into} onChange={(e) => setInto(e.target.value)} aria-label="The same person as">
          <option value="">Choose who…</option>
          {items
            .filter((x) => x.id !== c.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.organisation ? ` (${x.organisation})` : ''}
              </option>
            ))}
        </NativeSelect>
        <DialogFooter>
          <Button
            disabled={busy || !into}
            onClick={() =>
              void run((x) => x.stories.mergeCharacter(c.id, into), { success: 'Merged', failure: 'Couldn’t merge' }).then((ok) => {
                if (!ok) return
                onOpenChange(false)
                navigate(`/cast/${into}`)
              })
            }
          >
            {busy && <Spinner size="xs" tone="current" decorative />} Merge into them
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
