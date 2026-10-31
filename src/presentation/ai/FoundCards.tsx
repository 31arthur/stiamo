import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, ExternalLink, Eye, Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Found } from '@/domain/ai/AgentApi'
import { driveFileAsAttachment, FILE_KIND_SHORT, fileKind } from '@/domain/drive/Drive'
import { FilePreview } from '@/presentation/attachments/FilePreview'
import { useUserId } from '@/presentation/data/hooks'
import { FileTypeIcon } from '@/presentation/drive/FileTypeIcon'
import { driveAgo } from '@/presentation/drive/format'
import { Link } from '@/presentation/routing'

type CaseCard = Extract<Found, { kind: 'case' }>
type DocCard = Extract<Found, { kind: 'document' }>

/** What the agent found, as cards: the cases (each opens its page) and the documents (each opens in a reader). */
export function FoundCards({ found }: { found: Found[] }) {
  const userId = useUserId()
  const cases = found.filter((f): f is CaseCard => f.kind === 'case')
  const docs = found.filter((f): f is DocCard => f.kind === 'document')
  const readable = useMemo(() => docs.flatMap((d) => driveFileAsAttachment(d, userId) ?? []), [docs, userId])
  const [open, setOpen] = useState<number | null>(null)
  if (found.length === 0) return null

  return (
    <div className="grid gap-4">
      {cases.length > 0 && (
        <section aria-label="Cases found">
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Cases · {cases.length}</h3>
          <ul className="grid gap-1.5">
            {cases.map((c) => (
              <li key={c.id}>
                <Link to={`/cases/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-card/80 p-3 transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-float">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded bg-ws-sb-soft px-1.5 py-px font-mono text-[11px] font-medium text-ws-sb">{c.reference}</span>
                      <span className="text-[11px] text-muted-foreground">{c.status}</span>
                      {c.courtNumber && <span className="text-[11px] text-muted-foreground">{c.courtNumber}</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">{c.title}</div>
                    {(c.client || c.opposingParty) && <div className="truncate text-xs text-muted-foreground">{[c.client, c.opposingParty && `v. ${c.opposingParty}`].filter(Boolean).join(' ')}</div>}
                  </div>
                  {c.nextHearing && (
                    <div className="hidden shrink-0 items-center gap-1.5 text-right text-xs text-muted-foreground sm:flex">
                      <Gavel className="size-3.5" />
                      <span>
                        <span className="block font-medium text-foreground">{format(parseISO(c.nextHearing.date), 'EEE d MMM')}</span>
                        <span className="block max-w-32 truncate">{c.nextHearing.purpose}</span>
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {docs.length > 0 && (
        <section aria-label="Documents found">
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Documents · {docs.length}</h3>
          <ul className="grid gap-1.5">
            {docs.map((d) => {
              const i = readable.findIndex((a) => a.id === d.id)
              const kind = fileKind(d.mimeType, d.name)
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-xl border bg-card/80 p-2.5">
                  <FileTypeIcon kind={kind} className="h-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-px font-semibold text-foreground/80">{FILE_KIND_SHORT[kind]}</span>
                      {d.modifiedTime && <span>{driveAgo(d.modifiedTime)}</span>}
                      {d.filedUnder?.map((r) => (
                        <span key={r} className="inline-flex items-center gap-1 rounded-full bg-ws-sb-soft px-1.5 py-px font-medium text-ws-sb">
                          <Check className="size-3" /> {r}
                        </span>
                      ))}
                      {d.matched?.map((m) => (
                        <span key={m} className={cn('rounded-full bg-muted px-1.5 py-px')}>
                          mentions {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  {i >= 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setOpen(i)}>
                      <Eye /> <span className="max-sm:sr-only">View</span>
                    </Button>
                  )}
                  {d.webViewLink && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Open ${d.name} in Drive`} nativeButton={false} render={<a href={d.webViewLink} target="_blank" rel="noreferrer" />}>
                      <ExternalLink />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <FilePreview files={readable} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </div>
  )
}
