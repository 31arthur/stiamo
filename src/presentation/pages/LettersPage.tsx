import { useMemo, useState } from 'react'
import { Check, ExternalLink, FolderPlus, Inbox, MousePointerClick, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { casesForFile, driveFileAsAttachment, driveFileId, FILE_KIND_LABELS, fileKind } from '@/domain/drive/Drive'
import type { DriveFile, FileKind } from '@/domain/drive/Drive'
import { FilePreview, PreviewBody } from '@/presentation/attachments/FilePreview'
import { formatBytes } from '@/presentation/attachments/useAttachments'
import { Segmented } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { useAction, useEntities, useUserId } from '@/presentation/data/hooks'
import { FileTypeIcon } from '@/presentation/drive/FileTypeIcon'
import { dateBucket, driveAgo } from '@/presentation/drive/format'
import { useDebounced, useDriveSearch, useDriveStatus } from '@/presentation/drive/useDrive'
import { useMediaQuery } from '@/presentation/layout/useMediaQuery'

type KindFilter = 'all' | 'documents' | 'sheets' | 'pdf' | 'images'
const KIND_GROUPS: Record<Exclude<KindFilter, 'all'>, FileKind[]> = { documents: ['doc', 'word'], sheets: ['sheet', 'excel'], pdf: ['pdf'], images: ['image'] }

interface CaseChip {
  id: string
  reference: string
  title: string
}

/**
 * The S&B letters in Google Drive: newest first, searchable by what is in them, read in place beside the list, and
 * filed against cases so they can be reviewed from there later.
 */
export function LettersPage() {
  const drive = useDriveStatus()
  const userId = useUserId()
  const wide = useMediaQuery('(min-width: 1024px)')
  const [text, setText] = useState('')
  const settled = useDebounced(text, 350)
  const search = useDriveSearch(settled, drive.available, 0)
  const searching = settled.trim().length > 0
  const typing = text.trim() !== settled.trim()
  const [kind, setKind] = useState<KindFilter>('all')
  const [filing, setFiling] = useState<'all' | 'unfiled'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<number | null>(null)
  const [adding, setAdding] = useState<DriveFile | null>(null)

  const { data: cases } = useEntities('case')
  const { data: attachments } = useEntities('attachment')
  /** Drive file id → the cases it is filed under. */
  const linked = useMemo(() => {
    const byId = new Map<string, Set<string>>()
    for (const a of attachments) {
      const id = a.owner.kind === 'case' ? driveFileId(a.link?.url) : undefined
      if (id) byId.set(id, (byId.get(id) ?? new Set()).add(a.owner.id))
    }
    return byId
  }, [attachments])
  const chipsFor = (id: string): CaseChip[] => [...(linked.get(id) ?? [])].flatMap((cid) => cases.find((c) => c.id === cid) ?? [])

  const all = search.files
  const files = useMemo(
    () => all.filter((f) => (kind === 'all' || KIND_GROUPS[kind].includes(fileKind(f.mimeType, f.name))) && (filing === 'all' || !linked.has(f.id))),
    [all, kind, filing, linked],
  )
  const groups = useMemo(() => {
    const out: { label: string; files: DriveFile[] }[] = []
    for (const f of files) {
      const label = dateBucket(f.modifiedTime)
      const last = out[out.length - 1]
      if (last?.label === label) last.files.push(f)
      else out.push({ label, files: [f] })
    }
    return out
  }, [files])

  const previewable = useMemo(() => files.flatMap((f) => driveFileAsAttachment(f, userId) ?? []), [files, userId])
  const selected = files.find((f) => f.id === selectedId) ?? null
  const selectedAttachment = previewable.find((a) => a.id === selected?.id)
  const unfiledCount = all.filter((f) => !linked.has(f.id)).length

  const choose = (f: DriveFile) => {
    setSelectedId(f.id)
    if (!wide) {
      const i = previewable.findIndex((a) => a.id === f.id)
      if (i >= 0) setDialog(i)
    }
  }
  const step = (by: 1 | -1) => {
    const i = files.findIndex((f) => f.id === selectedId)
    const next = files[Math.min(files.length - 1, Math.max(0, i + by))]
    if (next) setSelectedId(next.id)
  }

  return (
    <>
      <PageHeader
        eyebrow="S&B Consultants · Legal"
        title="Letters"
        description={drive.folder ? `Everything in “${drive.folder}” on your Drive. Nothing is copied: files open from Google, and filing one under a case keeps only the link.` : 'The letters and orders in your Google Drive, newest first.'}
      />

      {!drive.available ? (
        <Section>
          <EmptyState title="Drive isn’t connected">Letters come from your Google Drive through the Stiamo backend. Once the server is connected to Drive (and signed in with an allowed email), they appear here.</EmptyState>
        </Section>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={searching ? 'Matches' : 'Letters'} value={`${all.length}${search.hasMore ? '+' : ''}`} />
            <Stat label="Filed under a case" value={all.length - unfiledCount} tone="success" />
            <Stat label="Not filed yet" value={unfiledCount} tone={unfiledCount ? 'warning' : 'default'} />
          </div>

          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search inside your letters: a name, a case number, a “quoted phrase”…" className="h-11 rounded-xl pl-10 text-base shadow-float" aria-label="Search letters" />
              {text && (
                <button type="button" aria-label="Clear search" onClick={() => setText('')} className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Kind of file"
                size="sm"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'documents', label: 'Documents' },
                  { value: 'sheets', label: 'Sheets' },
                  { value: 'pdf', label: 'PDFs' },
                  { value: 'images', label: 'Images' },
                ]}
              />
              <Segmented
                label="Filing"
                size="sm"
                value={filing}
                onChange={setFiling}
                options={[
                  { value: 'all', label: 'Everything' },
                  { value: 'unfiled', label: 'Not filed yet' },
                ]}
              />
              {(typing || search.loading) && <Spinner size="xs" tone="current" decorative />}
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
            <div
              className="grid gap-5"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  step(e.key === 'ArrowDown' ? 1 : -1)
                }
              }}
            >
              {search.error ? (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                  {search.error}
                </p>
              ) : files.length === 0 ? (
                <Section>
                  <EmptyState title={search.loading || typing ? 'Looking in your Drive…' : searching ? 'Nothing matches' : all.length ? 'Nothing here' : 'No letters yet'}>
                    {search.loading || typing ? null : searching ? 'No letter has all of those words in its name or contents.' : all.length ? 'No letter fits these filters.' : 'Letters you add to the Drive folder appear here.'}
                  </EmptyState>
                </Section>
              ) : (
                groups.map((g) => (
                  <section key={g.label} aria-label={g.label}>
                    <h2 className="mb-1.5 px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{g.label}</h2>
                    <ul className="grid gap-1.5">
                      {g.files.map((f) => (
                        <LetterRow key={f.id} file={f} cases={chipsFor(f.id)} selected={wide && f.id === selectedId} onChoose={() => choose(f)} onAdd={() => setAdding(f)} />
                      ))}
                    </ul>
                  </section>
                ))
              )}
              {search.hasMore && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={search.loadMore} disabled={search.loadingMore}>
                    {search.loadingMore ? <Spinner size="xs" tone="current" decorative /> : null} Show older letters
                  </Button>
                </div>
              )}
            </div>

            {wide && (
              <aside aria-label="Reader" className="sticky top-4 flex h-[calc(100dvh-2rem)] min-h-96 flex-col overflow-hidden rounded-2xl border bg-card shadow-lift">
                {selected ? (
                  <>
                    <header className="flex items-start gap-3 border-b px-4 py-3">
                      <FileTypeIcon kind={fileKind(selected.mimeType, selected.name)} className="mt-0.5 h-9" />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold" title={selected.name}>
                          {selected.name}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {[FILE_KIND_LABELS[fileKind(selected.mimeType, selected.name)], selected.size ? formatBytes(selected.size) : '', selected.modifiedTime ? `changed ${driveAgo(selected.modifiedTime)}` : ''].filter(Boolean).join(' · ')}
                        </p>
                        <CaseChips cases={chipsFor(selected.id)} className="mt-1.5" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {selected.webViewLink && (
                          <Button variant="ghost" size="icon-sm" aria-label="Open in Google Drive" render={<a href={selected.webViewLink} target="_blank" rel="noreferrer" />}>
                            <ExternalLink />
                          </Button>
                        )}
                        <Button size="sm" onClick={() => setAdding(selected)} disabled={!selected.webViewLink}>
                          <FolderPlus /> Add to case
                        </Button>
                      </div>
                    </header>
                    <div className="relative min-h-0 flex-1 bg-muted/40">
                      {selectedAttachment ? <PreviewBody key={selected.id} file={selectedAttachment} /> : <p className="p-6 text-sm text-muted-foreground">This file can’t be shown here. Open it in Drive.</p>}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-muted-foreground">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">{files.length ? <MousePointerClick className="size-6" /> : <Inbox className="size-6" />}</div>
                    <div className="font-display text-2xl text-foreground italic">Choose a letter to read</div>
                    <p className="max-w-xs text-sm">It opens right here. Use the arrow keys to move down the list, and “Add to case” to file it for review later.</p>
                  </div>
                )}
              </aside>
            )}
          </div>
        </>
      )}

      <FilePreview files={previewable} index={dialog} onIndexChange={setDialog} onClose={() => setDialog(null)} />
      <AddToCase file={adding} onClose={() => setAdding(null)} linkedCaseIds={adding ? (linked.get(adding.id) ?? new Set()) : new Set()} />
    </>
  )
}

function CaseChips({ cases, className }: { cases: CaseChip[]; className?: string }) {
  if (cases.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {cases.map((c) => (
        <Link key={c.id} to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} title={c.title} className="inline-flex items-center gap-1 rounded-full bg-ws-sb-soft px-2 py-0.5 text-[11px] font-medium text-ws-sb hover:underline">
          <Check className="size-3" /> {c.reference}
        </Link>
      ))}
    </div>
  )
}

function LetterRow({ file, cases, selected, onChoose, onAdd }: { file: DriveFile; cases: CaseChip[]; selected: boolean; onChoose: () => void; onAdd: () => void }) {
  const kind = fileKind(file.mimeType, file.name)
  return (
    <li>
      <div className={cn('group relative flex items-center gap-3 rounded-xl border bg-card/80 p-2.5 pr-2 transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-float', selected && 'border-foreground/30 bg-background shadow-float ring-1 ring-foreground/10')}>
        <button type="button" onClick={onChoose} aria-current={selected} aria-label={`Read ${file.name}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
          <FileTypeIcon kind={kind} className="h-10" />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-sm leading-snug font-medium break-words">{file.name}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{[FILE_KIND_LABELS[kind], file.size ? formatBytes(file.size) : '', driveAgo(file.modifiedTime)].filter(Boolean).join(' · ')}</div>
          </div>
        </button>
        <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
          {cases.length > 0 ? (
            <CaseChips cases={cases.slice(0, 1)} />
          ) : (
            <Button variant="outline" size="xs" onClick={onAdd} disabled={!file.webViewLink} aria-label={`Add ${file.name} to a case`} className="lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
              <FolderPlus /> <span className="max-sm:sr-only">File it</span>
            </Button>
          )}
          {cases.length > 1 && <span className="text-[10px] text-muted-foreground">+{cases.length - 1} more</span>}
        </div>
      </div>
    </li>
  )
}

/** Pick the case a letter belongs to; the link is kept with it to review later. */
function AddToCase({ file, onClose, linkedCaseIds }: { file: DriveFile | null; onClose: () => void; linkedCaseIds: Set<string> }) {
  const { data: cases } = useEntities('case')
  const [text, setText] = useState('')
  const [justLinked, setJustLinked] = useState<Set<string>>(new Set())
  const link = useAction<{ caseId: string; title: string }, unknown>((s, uid, a) => s.attachments.attachLink(uid, { kind: 'case', id: a.caseId }, a.title, file!.webViewLink!, file!.name), { success: 'Added to the case' })

  const fileName = file?.name ?? ''
  const rows = useMemo(() => {
    const q = text.trim().toLowerCase()
    return casesForFile(fileName, cases).filter(({ case: c }) => !q || [c.reference, c.courtNumber, c.title, c.client, c.opposingParty].some((t) => t?.toLowerCase().includes(q)))
  }, [cases, fileName, text])

  const close = () => {
    onClose()
    setText('')
    setJustLinked(new Set())
  }
  const add = async (caseId: string, title: string) => {
    try {
      await link.run({ caseId, title })
      setJustLinked((s) => new Set(s).add(caseId))
    } catch {
      // The action already showed what went wrong.
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Add to a case</DialogTitle>
          <DialogDescription className="truncate">{file?.name}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Case number, title, client…" className="pl-9" aria-label="Find a case" />
        </div>
        <ul className="grid max-h-[50vh] gap-0.5 overflow-y-auto">
          {rows.length === 0 && <li className="px-2 py-6 text-sm text-muted-foreground">No case matches.</li>}
          {rows.map(({ case: c, suggested }) => {
            const done = linkedCaseIds.has(c.id) || justLinked.has(c.id)
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span>{c.reference}</span>
                    {c.courtNumber && <span>{c.courtNumber}</span>}
                    {suggested && <span className="rounded-full bg-muted px-1.5 py-px text-foreground">Named in the file</span>}
                  </div>
                </div>
                {done ? (
                  <span className="flex items-center gap-1 px-2 text-xs text-success">
                    <Check className="size-3.5" /> Linked
                  </span>
                ) : (
                  <Button size="sm" variant="outline" disabled={link.pending} onClick={() => add(c.id, c.title)}>
                    Add
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
