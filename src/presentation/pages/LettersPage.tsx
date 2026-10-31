import { useMemo, useState } from 'react'
import { Check, Eye, FolderPlus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { casesForFile, driveFileAsAttachment, driveFileId } from '@/domain/drive/Drive'
import type { DriveFile } from '@/domain/drive/Drive'
import { FilePreview } from '@/presentation/attachments/FilePreview'
import { EmptyState, PageHeader, Section } from '@/presentation/components/layout'
import { useAction, useEntities, useUserId } from '@/presentation/data/hooks'
import { DriveIcon } from '@/presentation/drive/DriveFinder'
import { driveDate } from '@/presentation/drive/format'
import { useDebounced, useDriveSearch, useDriveStatus } from '@/presentation/drive/useDrive'

/** The S&B letters in Google Drive: the newest first, searchable by what is in them, viewable here and linkable to cases. */
export function LettersPage() {
  const drive = useDriveStatus()
  const userId = useUserId()
  const [text, setText] = useState('')
  const settled = useDebounced(text, 350)
  const search = useDriveSearch(settled, drive.available, 0)
  const searching = settled.trim().length > 0
  const typing = text.trim() !== settled.trim()
  const [preview, setPreview] = useState<number | null>(null)
  const [adding, setAdding] = useState<DriveFile | null>(null)

  const { data: cases } = useEntities('case')
  const { data: attachments } = useEntities('attachment')
  /** Drive file id → the cases it is linked to. */
  const linked = useMemo(() => {
    const byId = new Map<string, Set<string>>()
    for (const a of attachments) {
      const id = a.owner.kind === 'case' ? driveFileId(a.link?.url) : undefined
      if (id) byId.set(id, (byId.get(id) ?? new Set()).add(a.owner.id))
    }
    return byId
  }, [attachments])

  const previewable = useMemo(() => search.files.flatMap((f) => driveFileAsAttachment(f, userId) ?? []), [search.files, userId])
  const openPreview = (f: DriveFile) => {
    const i = previewable.findIndex((a) => a.id === f.id)
    if (i >= 0) setPreview(i)
  }

  return (
    <>
      <PageHeader
        eyebrow="S&B Consultants · Legal"
        title="Letters"
        description={drive.folder ? `Everything in “${drive.folder}” on your Drive. Nothing is copied: files open from Google, and linking one to a case keeps only the link.` : 'The letters and orders in your Google Drive, newest first.'}
      />

      {!drive.available ? (
        <Section>
          <EmptyState title="Drive isn’t connected">Letters come from your Google Drive through the Stiamo backend. Once the server is connected to Drive (and signed in with an allowed email), they appear here.</EmptyState>
        </Section>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search the words inside your letters, or a “quoted phrase”…" className="pl-9" aria-label="Search letters" />
          </div>

          <Section title={searching ? 'Matching letters' : 'Latest letters'} description={searching ? 'Every word has to appear in the file’s name or contents.' : 'Most recently changed first.'} bodyClassName="p-2">
            {search.error ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                {search.error}
              </p>
            ) : search.files.length === 0 ? (
              <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                {search.loading || typing ? (
                  <>
                    <Spinner size="xs" tone="current" decorative /> Looking in your Drive…
                  </>
                ) : searching ? (
                  'No letter contains all of those words.'
                ) : (
                  'No letters in the folder yet.'
                )}
              </p>
            ) : (
              <ul className="grid gap-0.5">
                {search.files.map((f) => (
                  <LetterRow
                    key={f.id}
                    file={f}
                    cases={[...(linked.get(f.id) ?? [])].flatMap((id) => cases.find((c) => c.id === id) ?? [])}
                    canPreview={previewable.some((a) => a.id === f.id)}
                    onPreview={() => openPreview(f)}
                    onAdd={() => setAdding(f)}
                  />
                ))}
              </ul>
            )}
            {search.hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={search.loadMore} disabled={search.loadingMore}>
                  {search.loadingMore ? <Spinner size="xs" tone="current" decorative /> : null} Show more
                </Button>
              </div>
            )}
          </Section>
        </>
      )}

      <FilePreview files={previewable} index={preview} onIndexChange={setPreview} onClose={() => setPreview(null)} />
      <AddToCase file={adding} onClose={() => setAdding(null)} linkedCaseIds={adding ? (linked.get(adding.id) ?? new Set()) : new Set()} />
    </>
  )
}

function LetterRow({ file, cases, canPreview, onPreview, onAdd }: { file: DriveFile; cases: { id: string; reference: string; title: string }[]; canPreview: boolean; onPreview: () => void; onAdd: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <DriveIcon mime={file.mimeType} className="size-5 shrink-0 text-muted-foreground" />
      <button type="button" onClick={onPreview} disabled={!canPreview} className="min-w-0 flex-1 text-left" aria-label={`Preview ${file.name}`}>
        <div className="truncate text-sm font-medium">{file.name}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {file.modifiedTime && <span>{driveDate(file.modifiedTime)}</span>}
          {cases.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} title={c.title} className="rounded-full bg-ws-sb-soft px-1.5 py-px text-ws-sb hover:underline">
              {c.reference}
            </Link>
          ))}
        </div>
      </button>
      <Button variant="ghost" size="sm" onClick={onPreview} disabled={!canPreview}>
        <Eye /> <span className="max-sm:sr-only">View</span>
      </Button>
      <Button variant="outline" size="sm" onClick={onAdd} disabled={!file.webViewLink}>
        <FolderPlus /> <span className="max-sm:sr-only">Add to case</span>
      </Button>
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
