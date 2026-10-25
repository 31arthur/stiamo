import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { categorize } from '@/domain/attachments/Attachment'
import type { Attachment } from '@/domain/attachments/Attachment'
import { FileIcon } from './FileIcon'
import { formatBytes, useFileUrl } from './useAttachments'

/** Full-screen previewer with keyboard/arrow navigation across a record's files. */
export function FilePreview({ files, index, onIndexChange, onClose }: { files: Attachment[]; index: number | null; onIndexChange: (i: number) => void; onClose: () => void }) {
  const file = index !== null ? files[index] : undefined

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < files.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, files.length, onIndexChange])

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:w-[min(1100px,94vw)] sm:max-w-none sm:rounded-2xl"
      >
        {file && (
          <>
            <header className="flex items-center gap-2 border-b px-3 py-2 sm:px-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-sm font-medium">{file.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {formatBytes(file.size)} · {format(parseISO(file.createdAt), 'd MMM yyyy, HH:mm')}
                  {files.length > 1 && ` · ${index! + 1} of ${files.length}`}
                </DialogDescription>
              </div>
              <FileActions file={file} />
              <Button variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}>
                <X />
              </Button>
            </header>
            <div className="relative min-h-0 flex-1 bg-muted/40">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={file.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0">
                  <PreviewBody file={file} />
                </motion.div>
              </AnimatePresence>
              {index! > 0 && (
                <NavButton side="left" onClick={() => onIndexChange(index! - 1)}>
                  <ChevronLeft />
                </NavButton>
              )}
              {index! < files.length - 1 && (
                <NavButton side="right" onClick={() => onIndexChange(index! + 1)}>
                  <ChevronRight />
                </NavButton>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NavButton({ side, onClick, children }: { side: 'left' | 'right'; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous file' : 'Next file'}
      className={cn('absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-float backdrop-blur hover:bg-background', side === 'left' ? 'left-3' : 'right-3')}
    >
      {children}
    </button>
  )
}

function FileActions({ file }: { file: Attachment }) {
  const { data: url } = useFileUrl(file)
  if (!url) return null
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Open in new tab" render={<a href={url} target="_blank" rel="noreferrer" />}>
        <ExternalLink />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Download" render={<a href={url} download={file.name} />}>
        <Download />
      </Button>
    </>
  )
}

function PreviewBody({ file }: { file: Attachment }) {
  const { data: url, isLoading, error } = useFileUrl(file)
  const category = categorize(file.mime, file.name)
  if (isLoading) return <Centered><Loader2 className="size-6 animate-spin text-muted-foreground" /></Centered>
  if (error || !url) return <Centered><p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load this file'}</p></Centered>

  switch (category) {
    case 'image':
      return <ImageViewer url={url} name={file.name} />
    case 'pdf':
      return <iframe src={url} title={file.name} className="size-full border-0 bg-white" />
    case 'video':
      return (
        <Centered>
          <video src={url} controls className="max-h-full max-w-full rounded-lg" />
        </Centered>
      )
    case 'audio':
      return (
        <Centered>
          <div className="grid w-full max-w-md gap-4 rounded-2xl border bg-background p-6">
            <FileIcon category="audio" name={file.name} className="mx-auto size-20 rounded-2xl" />
            <audio src={url} controls className="w-full" />
          </div>
        </Centered>
      )
    case 'text':
      return <TextViewer url={url} />
    default:
      return (
        <Centered>
          <div className="grid max-w-sm justify-items-center gap-3 text-center">
            <FileIcon category={category} name={file.name} className="size-24 rounded-2xl" />
            <p className="text-sm text-muted-foreground">Browsers can’t preview this kind of file inline. Open it in its app or download it.</p>
            <div className="flex gap-2">
              <Button variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />}>
                <ExternalLink /> Open
              </Button>
              <Button render={<a href={url} download={file.name} />}>
                <Download /> Download
              </Button>
            </div>
          </div>
        </Centered>
      )
  }
}

function ImageViewer({ url, name }: { url: string; name: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <div className={cn('size-full overflow-auto', !zoomed && 'flex items-center justify-center p-4')}>
      <img
        src={url}
        alt={name}
        onClick={() => setZoomed(!zoomed)}
        className={cn('select-none', zoomed ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in rounded-lg object-contain shadow-float')}
      />
      <button type="button" onClick={() => setZoomed(!zoomed)} aria-label={zoomed ? 'Fit to screen' : 'Actual size'} className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-background/90 shadow-float">
        {zoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
      </button>
    </div>
  )
}

function TextViewer({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    fetch(url)
      .then((r) => r.text())
      .then((t) => active && setText(t))
      .catch(() => active && setText('Couldn’t read this file.'))
    return () => {
      active = false
    }
  }, [url])
  return <pre className="size-full overflow-auto bg-background p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap sm:p-6">{text ?? 'Loading…'}</pre>
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex size-full items-center justify-center p-4">{children}</div>
}
