import { useMemo, useState } from 'react'
import { Drama, Newspaper, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { WORKSPACES } from '@/domain/shared/workspace'
import { sketchOf } from '@/domain/stories/Stories'
import type { Character, DraftCard } from '@/domain/stories/Stories'
import { ProposalCards } from '@/presentation/agents/ProposalCards'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { Field, NativeSelect } from '@/presentation/components/form'
import { PageHeader } from '@/presentation/components/layout'
import { WorkspacePicker } from '@/presentation/components/workspace'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { Link, useNavigate } from '@/presentation/routing'
import { useCharacters, useParts, useStoriesAvailable, useStoryAction, useStoryList } from './useStories'

/** The people in your stories: each learned once, with what is known about them, used in every story they're part of. */
export function CastPage() {
  useDocumentTitle('Cast')
  const { scope } = useWorkspaceFilter()
  const available = useStoriesAvailable()
  const { items, loading, error } = useCharacters()
  const parts = useParts()
  const { items: stories } = useStoryList()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [reading, setReading] = useState(false)

  const here = useMemo(() => {
    if (scope === 'all') return items
    const storyWs = new Map(stories.map((s) => [s.id, s.workspace]))
    const inWs = new Set((parts.data ?? []).filter((p) => storyWs.get(p.storyId) === scope).map((p) => p.characterId))
    return items.filter((c) => c.home === scope || inWs.has(c.id))
  }, [items, parts.data, stories, scope])
  const shown = here.filter((c) => !q.trim() || `${c.name} ${c.organisation ?? ''} ${c.phones.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const partsOf = (id: string) => (parts.data ?? []).filter((p) => p.characterId === id).length

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Cast"
        description="People learned once, used in every story. Who they are travels with them; what they did stays in the story it happened in. What's known about them is added up from scenes and your answers, never guessed."
        actions={
          available && (
            <>
              <Button variant="outline" size="sm" onClick={() => setReading(true)}>
                <Newspaper /> From a news item or mail
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <UserPlus /> Add someone
              </Button>
            </>
          )
        }
      />
      {!available ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">The cast needs the Stiamo backend.</p>
      ) : loading ? (
        <Spinner label="Loading the cast" />
      ) : error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      ) : here.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted">
            <Drama className="size-5" />
          </span>
          <div>
            <p className="font-medium">Nobody in the cast yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">People named in your chapters join when you keep the margin notes. You can also add someone, or pick them out of a news item or a mail.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search the cast</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, organisation or number" className="pl-9" />
          </label>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => (
              <li key={c.id}>
                <CharacterCard c={c} stories={partsOf(c.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {available && <AddSomeone open={adding} onOpenChange={setAdding} />}
      {available && <FromText open={reading} onOpenChange={setReading} />}
    </>
  )
}

function CharacterCard({ c, stories }: { c: Character; stories: number }) {
  const conflicts = c.profile?.conflicts?.length ?? 0
  return (
    <Link to={`/cast/${c.id}`} className="grid h-full content-start gap-2.5 rounded-2xl border bg-card/80 p-4 transition-colors hover:bg-muted/30">
      <header className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">{c.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <div className="truncate font-medium">{c.name}</div>
          <div className="truncate text-xs text-muted-foreground">{[c.title, c.organisation].filter(Boolean).join(', ') || (c.phones[0] ?? 'No number yet')}</div>
        </div>
      </header>
      <p className="font-display text-base leading-snug text-muted-foreground italic">{sketchOf(c.name.split(' ')[0], c.profile)}</p>
      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        <span className="rounded-md bg-muted px-1.5 py-0.5">
          In {stories} {stories === 1 ? 'story' : 'stories'}
        </span>
        {conflicts > 0 && <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-warning">{conflicts} thing{conflicts === 1 ? '' : 's'} unsure</span>}
      </div>
    </Link>
  )
}

function AddSomeone({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { scope } = useWorkspaceFilter()
  const navigate = useNavigate()
  const { run, busy } = useStoryAction()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [org, setOrg] = useState('')
  const [home, setHome] = useState<WorkspaceId>(scope === 'all' ? 'personal' : scope)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Add someone</DialogTitle>
          <DialogDescription>Someone already in the cast with the same number is found instead of added twice.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run((x) => x.stories.joinCast({ name: name.trim(), phones: phone.trim() ? [phone.trim()] : [], organisation: org.trim() || undefined, home }), { failure: 'Couldn’t add them' }).then((out) => {
              if (!out) return
              onOpenChange(false)
              navigate(`/cast/${out.character.id}`)
            })
          }}
        >
          <Field label="Name" htmlFor="cast-name">
            <Input id="cast-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Phone" htmlFor="cast-phone">
            <Input id="cast-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98450 12345" />
          </Field>
          <Field label="Organisation" htmlFor="cast-org">
            <Input id="cast-org" value={org} onChange={(e) => setOrg(e.target.value)} />
          </Field>
          <Field label="First met in" htmlFor="cast-home">
            <WorkspacePicker id="cast-home" value={home} onChange={setHome} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Spinner size="xs" tone="current" decorative />} Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Paste a news item or a mail: the people named in it come back as a card, with only numbers that are really in the text. */
function FromText({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run, busy, refresh } = useStoryAction()
  const { items: stories } = useStoryList()
  const [text, setText] = useState('')
  const [story, setStory] = useState('')
  const [cards, setCards] = useState<DraftCard[] | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setCards(null)
          void refresh()
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">People in a text</DialogTitle>
          <DialogDescription>Paste the article or the mail. Nothing is added until you approve the card.</DialogDescription>
        </DialogHeader>
        {!cards ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void run((x) => x.stories.peopleFromText(text, story || undefined), { failure: 'Couldn’t read it' }).then((out) => {
                if (!out) return
                if (out.none || !out.cards?.length) setCards([])
                else setCards(out.cards)
              })
            }}
          >
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Kalaburagi: Assistant Labour Commissioner R. Nayak said…" aria-label="The text" />
            <Field label="Into a story (optional)" htmlFor="text-story">
              <NativeSelect id="text-story" value={story} onChange={(e) => setStory(e.target.value)}>
                <option value="">Not into a story</option>
                {stories
                  .filter((s) => s.state !== 'ended')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={busy || !text.trim()}>
                {busy && <Spinner size="xs" tone="current" decorative />} Find the people
              </Button>
            </DialogFooter>
          </form>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is named in it.</p>
        ) : (
          <ProposalCards proposals={cards.map((c) => ({ ...c, action: 'cast.join' }))} />
        )}
      </DialogContent>
    </Dialog>
  )
}
