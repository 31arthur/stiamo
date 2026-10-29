import { useState } from 'react'
import { Check, ExternalLink, FileImage, FileSpreadsheet, FileText, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { DriveFile, DriveMatch } from '@/domain/drive/Drive'
import type { EntityRef } from '@/domain/shared/types'
import { useAction } from '@/presentation/data/hooks'
import { driveDate } from './format'
import { useDebounced, useDriveSearch, useDriveSuggestions } from './useDrive'

/** The icon for a kind of file. */
export function DriveIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return <FileSpreadsheet className={className} />
  if (mime.startsWith('image/')) return <FileImage className={className} />
  return <FileText className={className} />
}

/**
 * Find letters in the owner's Google Drive by what is in them, and keep a link to one with a record. The file
 * stays in Drive; only the link is stored. Records that have identifying details (a case's number, parties…) get
 * suggestions before anything is typed.
 */
export function DriveFinder({
  open,
  onClose,
  owner,
  ownerTitle,
  suggestTerms = [],
  attachedIds,
}: {
  open: boolean
  onClose: () => void
  owner: EntityRef
  ownerTitle: string
  suggestTerms?: string[]
  /** Drive file ids already attached to this record. */
  attachedIds: Set<string>
}) {
  const [text, setText] = useState('')
  const settled = useDebounced(text, 350)
  const searching = settled.trim().length >= 2
  const search = useDriveSearch(settled, open)
  const suggestions = useDriveSuggestions(suggestTerms, open && !searching && text.trim().length < 2)
  const [justAttached, setJustAttached] = useState<Set<string>>(new Set())

  const attach = useAction<DriveFile, unknown>((s, userId, f) => s.attachments.attachLink(userId, owner, ownerTitle, f.webViewLink!, f.name), { success: 'Letter linked' })
  const isAttached = (f: DriveFile) => attachedIds.has(f.id) || justAttached.has(f.id)
  const add = async (f: DriveFile) => {
    try {
      await attach.run(f)
      setJustAttached((s) => new Set(s).add(f.id))
    } catch {
      // The action already showed what went wrong.
    }
  }

  const close = () => {
    onClose()
    setText('')
  }
  const showingSuggestions = !searching && text.trim().length < 2
  const rows: (DriveFile | DriveMatch)[] = showingSuggestions ? suggestions.matches : search.files
  const loading = showingSuggestions ? suggestions.loading : search.loading || text.trim() !== settled.trim()
  const error = showingSuggestions ? suggestions.error : search.error

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Find in Drive</DialogTitle>
          <DialogDescription>Searches the names and contents of your letters. Nothing is copied: the file stays in Drive and only a link is kept here.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Words in the letter, or a “quoted phrase”…" className="pl-9" aria-label="Search your Drive" />
        </div>

        {showingSuggestions && suggestTerms.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Letters that mention <span className="text-foreground">{suggestTerms.join(' · ')}</span>, best match first.
            </span>
          </p>
        )}

        <div className="max-h-[50vh] min-h-24 overflow-y-auto">
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
              {loading ? (
                <>
                  <Spinner size="xs" tone="current" decorative /> Searching your Drive…
                </>
              ) : showingSuggestions ? (
                suggestTerms.length > 0 ? (
                  'No letters mention this case yet. Type a word to search.'
                ) : (
                  'Type a word or two to search your letters.'
                )
              ) : (
                'No letter contains all of those words.'
              )}
            </p>
          ) : (
            <ul className="grid gap-1">
              {rows.map((f) => (
                <FileRow key={f.id} file={f} attached={isAttached(f)} busy={attach.pending} onAttach={() => add(f)} />
              ))}
            </ul>
          )}
          {!showingSuggestions && search.hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" size="sm" onClick={search.loadMore} disabled={search.loadingMore}>
                {search.loadingMore ? <Spinner size="xs" tone="current" decorative /> : null} Show more
              </Button>
            </div>
          )}
          {loading && rows.length > 0 && (
            <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <Spinner size="xs" tone="current" decorative /> Updating…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FileRow({ file, attached, busy, onAttach }: { file: DriveFile | DriveMatch; attached: boolean; busy: boolean; onAttach: () => void }) {
  const matched = 'matched' in file ? file.matched : []
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <DriveIcon mime={file.mimeType} className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{file.name}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {file.modifiedTime && <span>{driveDate(file.modifiedTime)}</span>}
          {matched.map((m) => (
            <span key={m} className="rounded-full bg-muted px-1.5 py-px">
              {m}
            </span>
          ))}
        </div>
      </div>
      {file.webViewLink && (
        <Button variant="ghost" size="icon-sm" aria-label={`Open ${file.name} in Drive`} render={<a href={file.webViewLink} target="_blank" rel="noreferrer" />}>
          <ExternalLink />
        </Button>
      )}
      {attached ? (
        <span className="flex items-center gap-1 px-2 text-xs text-success">
          <Check className="size-3.5" /> Linked
        </span>
      ) : (
        <Button size="sm" variant="outline" disabled={busy || !file.webViewLink} onClick={onAttach}>
          Link
        </Button>
      )}
    </li>
  )
}
