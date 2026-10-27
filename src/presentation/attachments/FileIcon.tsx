import { ClipboardList, File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, Globe, HardDrive, Link2, Presentation } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileCategory, LinkProvider } from '@/domain/attachments/Attachment'

export const CATEGORY_STYLE: Record<FileCategory, { icon: LucideIcon; tone: string }> = {
  image: { icon: FileImage, tone: 'bg-ws-personal-soft text-ws-personal' },
  pdf: { icon: FileText, tone: 'bg-destructive/10 text-destructive' },
  video: { icon: FileVideo, tone: 'bg-ws-media-soft text-ws-media' },
  audio: { icon: FileAudio, tone: 'bg-ws-media-soft text-ws-media' },
  text: { icon: FileText, tone: 'bg-muted text-muted-foreground' },
  document: { icon: FileText, tone: 'bg-ws-sb-soft text-ws-sb' },
  spreadsheet: { icon: FileSpreadsheet, tone: 'bg-success/12 text-success' },
  presentation: { icon: Presentation, tone: 'bg-warning/15 text-warning' },
  archive: { icon: FileArchive, tone: 'bg-muted text-muted-foreground' },
  link: { icon: Link2, tone: 'bg-muted text-muted-foreground' },
  other: { icon: File, tone: 'bg-muted text-muted-foreground' },
}

export function FileIcon({ category, name, className }: { category: FileCategory; name: string; className?: string }) {
  const style = CATEGORY_STYLE[category]
  const ext = name.includes('.') ? name.split('.').pop()!.slice(0, 4).toUpperCase() : ''
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1', style.tone, className)}>
      <style.icon className="size-7" strokeWidth={1.5} />
      {ext && <span className="text-[10px] font-semibold tracking-wider">{ext}</span>}
    </div>
  )
}

/** Google's documents each get their own colour, so a card says what it is before it's opened. */
export const PROVIDER_STYLE: Record<LinkProvider, { icon: LucideIcon; tone: string }> = {
  'google-doc': { icon: FileText, tone: 'bg-ws-sb-soft text-ws-sb' },
  'google-sheet': { icon: FileSpreadsheet, tone: 'bg-success/12 text-success' },
  'google-slides': { icon: Presentation, tone: 'bg-warning/15 text-warning' },
  'google-drive': { icon: HardDrive, tone: 'bg-ws-fsa-soft text-ws-fsa' },
  'google-folder': { icon: Folder, tone: 'bg-ws-fsa-soft text-ws-fsa' },
  'google-form': { icon: ClipboardList, tone: 'bg-ws-media-soft text-ws-media' },
  web: { icon: Globe, tone: 'bg-muted text-muted-foreground' },
}

export function LinkTile({ provider, className }: { provider: LinkProvider; className?: string }) {
  const style = PROVIDER_STYLE[provider]
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1', style.tone, className)}>
      <style.icon className="size-7" strokeWidth={1.5} />
      <span className="text-[10px] font-semibold tracking-wider">{provider === 'web' ? 'LINK' : 'GOOGLE'}</span>
    </div>
  )
}
