import { useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { Link2, Paperclip, Search, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { categoryOf, describeLink, PROVIDER_LABELS } from '@/domain/attachments/Attachment'
import type { Attachment } from '@/domain/attachments/Attachment'
import type { EntityRef } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { useRecordLookup } from '@/presentation/components/records'
import { useAction, useUserId } from '@/presentation/data/hooks'
import { spring } from '@/presentation/motion/presets'
import { Field } from '@/presentation/components/form'
import { Skeleton } from '@/presentation/components/loading'
import { DriveFinder } from '@/presentation/drive/DriveFinder'
import { attachedDriveIds } from '@/presentation/drive/format'
import { useDriveStatus } from '@/presentation/drive/useDrive'
import { FileIcon, LinkTile } from './FileIcon'
import { FilePreview } from './FilePreview'
import { formatBytes, useAttachments, useFileUrl } from './useAttachments'

interface Upload {
  id: string
  name: string
  progress: number
}

/** Supporting documents for a record: drop, paste or pick files; preview them in place. */
export function AttachmentsPanel({ owner, compact = false, className, suggestTerms }: { owner: EntityRef; compact?: boolean; className?: string; suggestTerms?: string[] }) {
  const services = useServices()
  const userId = useUserId()
  const files = useAttachments(owner)
  const { lookup } = useRecordLookup()
  const ownerTitle = lookup(owner)?.title ?? ''
  const input = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const [linking, setLinking] = useState(false)
  const [finding, setFinding] = useState(false)
  const drive = useDriveStatus()
  const [preview, setPreview] = useState<number | null>(null)
  const remove = useAction<Attachment, void>((s, uid, a) => s.attachments.remove(uid, a, ownerTitle), { success: 'File removed' })

  async function upload(list: FileList | File[]) {
    for (const file of Array.from(list)) {
      const id = crypto.randomUUID()
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }])
      try {
        await services.attachments.attach(userId, owner, ownerTitle, file, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Couldn’t upload ${file.name}`)
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id))
      }
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }
  const attachLink = useAction<{ address: string; name?: string }, unknown>((s, uid, l) => s.attachments.attachLink(uid, owner, ownerTitle, l.address, l.name), { success: 'Link added' })
  const onPaste = (e: ClipboardEvent) => {
    if (e.clipboardData.files.length) {
      e.preventDefault()
      return void upload(e.clipboardData.files)
    }
    // Pasting a Google Docs address (outside a text field) attaches it, ready to preview.
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, [contenteditable]')) return
    const text = e.clipboardData.getData('text/plain').trim()
    if (/^https:\/\/(docs|drive)\.google\.com\//.test(text) && describeLink(text)) {
      e.preventDefault()
      void attachLink.run({ address: text })
    }
  }

  return (
    <div
      className={cn('relative grid gap-3', className)}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget as Node) || setDragging(false)}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files).then(() => (e.target.value = ''))} />

      {files.length === 0 && uploads.length === 0 ? (
        <div className="grid gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground', dragging && 'border-foreground/40 bg-muted/50 text-foreground')}
        >
          <UploadCloud className="size-6" />
          <span className="font-medium">Drop files, paste, or browse</span>
          <span className="text-xs">PDFs, images, documents, recordings — up to 25 MB each</span>
        </button>
        <div className="flex flex-wrap justify-center gap-1">
          {drive.available && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setFinding(true)}>
              <Search /> Find in Drive
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLinking(true)}>
            <Link2 /> Or link a Google Doc, Sheet or web page
          </Button>
        </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="size-3.5" /> {files.length} file{files.length === 1 ? '' : 's'}
            </span>
            <div className="flex gap-1">
              {drive.available && (
                <Button variant="ghost" size="xs" onClick={() => setFinding(true)}>
                  <Search /> Find in Drive
                </Button>
              )}
              <Button variant="ghost" size="xs" onClick={() => setLinking(true)}>
                <Link2 /> Add link
              </Button>
              <Button variant="ghost" size="xs" onClick={() => input.current?.click()}>
                <UploadCloud /> Add files
              </Button>
            </div>
          </div>
          <ul className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
            <AnimatePresence initial={false}>
              {uploads.map((u) => (
                <motion.li key={u.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col justify-end gap-2 rounded-xl border bg-card p-3">
                  <span className="truncate text-xs font-medium">{u.name}</span>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full bg-foreground" animate={{ width: `${Math.max(5, u.progress * 100)}%` }} />
                  </div>
                </motion.li>
              ))}
              {files.map((f, i) => (
                <FileCard key={f.id} file={f} onOpen={() => setPreview(i)} onRemove={() => remove.run(f)} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}

      <AnimatePresence>
        {dragging && (files.length > 0 || uploads.length > 0) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-foreground/40 bg-background/80 text-sm font-medium backdrop-blur-sm">
            <UploadCloud className="mr-2 size-5" /> Drop to attach
          </motion.div>
        )}
      </AnimatePresence>

      <FilePreview files={files} index={preview} onIndexChange={setPreview} onClose={() => setPreview(null)} />
      {drive.available && <DriveFinder open={finding} onClose={() => setFinding(false)} owner={owner} ownerTitle={ownerTitle} suggestTerms={suggestTerms} attachedIds={attachedDriveIds(files.map((f) => f.link?.url))} />}
      <LinkDialog open={linking} onClose={() => setLinking(false)} onAdd={async (address, name) => void (await attachLink.run({ address, name }))} />
    </div>
  )
}

/** Paste an address (a Google Doc, Sheet, Slides, Drive file or any web page) and keep it with the record. */
function LinkDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (address: string, name?: string) => Promise<void> }) {
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const link = describeLink(address)
  const invalid = address.trim() !== '' && !link

  function close() {
    onClose()
    setAddress('')
    setName('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!link) return
    setBusy(true)
    try {
      await onAdd(address, name)
      close()
    } catch {
      // The action already showed what went wrong.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Link a document</DialogTitle>
          <DialogDescription>Google Docs, Sheets, Slides and Drive files open right here. Anything else opens in a new tab.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Address" htmlFor="link-url" hint={link ? PROVIDER_LABELS[link.provider] + (link.embedUrl ? ' · can be viewed here' : '') : undefined}>
            <Input id="link-url" autoFocus value={address} onChange={(e) => setAddress(e.target.value)} placeholder="https://docs.google.com/document/d/…" inputMode="url" aria-invalid={invalid} />
          </Field>
          {invalid && <p className="-mt-2 text-xs text-destructive">That doesn’t look like a web address — it should start with https://</p>}
          <Field label="Name" htmlFor="link-name" hint="Optional — shown on the card">
            <Input id="link-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Statement of work" />
          </Field>
          {link?.embedUrl && link.provider.startsWith('google') && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">For others to see it here, the file must be shared with their Google account, or set to “Anyone with the link”.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!link || busy}>
              Add link
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FileCard({ file, onOpen, onRemove }: { file: Attachment; onOpen: () => void; onRemove: () => void }) {
  const category = categoryOf(file)
  const { data: url, isLoading: loadingThumb } = useFileUrl(category === 'image' ? file : undefined)
  const [confirming, setConfirming] = useState(false)
  return (
    <motion.li layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring.soft} className="group relative overflow-hidden rounded-xl border bg-card">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Preview ${file.name}`}>
        <div className="aspect-[4/3] overflow-hidden bg-muted/50">
          {url ? (
            <img src={url} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : loadingThumb ? (
            <Skeleton className="size-full rounded-none" />
          ) : file.link ? (
            <LinkTile provider={file.link.provider} className="size-full" />
          ) : (
            <FileIcon category={category} name={file.name} className="size-full" />
          )}
        </div>
        <div className="p-2">
          <div className="truncate text-xs font-medium">{file.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {file.link ? PROVIDER_LABELS[file.link.provider] : formatBytes(file.size)} · {format(parseISO(file.createdAt), 'd MMM')}
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={() => (confirming ? onRemove() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        className={cn(
          'absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-1 text-[10px] font-medium shadow-float backdrop-blur transition-opacity',
          confirming ? 'text-destructive opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100',
        )}
      >
        <Trash2 className="size-3" /> {confirming && 'Remove?'}
      </button>
    </motion.li>
  )
}

/** Paperclip badge with a count, for list rows. */
export function AttachmentBadge({ count }: { count: number | undefined }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
      <Paperclip className="size-3" />
      {count}
    </span>
  )
}
