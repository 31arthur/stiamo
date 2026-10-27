import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ExternalLink, Info, Loader2, ShieldQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PROVIDER_LABELS } from '@/domain/attachments/Attachment'
import type { Attachment, DocumentLink } from '@/domain/attachments/Attachment'
import { FileIcon, LinkTile } from './FileIcon'

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex size-full items-center justify-center p-4">{children}</div>
}

const Spinner = () => (
  <Centered>
    <Loader2 className="size-6 animate-spin text-muted-foreground" />
  </Centered>
)

/** Runs an async load for `key` and reports loading, the value, or the error message. */
function useLoad<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; value?: T; error?: string }>({ key: '' })
  useEffect(() => {
    let active = true
    load()
      .then((value) => active && setState({ key, value }))
      .catch((e) => active && setState({ key, error: e instanceof Error ? e.message : 'Couldn’t read this file' }))
    return () => {
      active = false
    }
    // `load` is built from `key` by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? state : { key }
}

const fetchBuffer = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Couldn’t download this file')
  return res
}

/**
 * A document that lives elsewhere. Google's own files are framed in place; they show for anyone
 * Google would let open them (shared "anyone with the link", or with the account that's signed in).
 */
export function LinkViewer({ link, name }: { link: DocumentLink; name: string }) {
  const [loaded, setLoaded] = useState(false)
  if (!link.embedUrl) {
    return (
      <Centered>
        <div className="grid max-w-sm justify-items-center gap-3 text-center">
          <LinkTile provider={link.provider} className="size-20 rounded-2xl" />
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{PROVIDER_LABELS[link.provider]}</div>
          </div>
          <p className="text-sm text-muted-foreground">This can’t be shown inside Stiamo — it opens on its own site.</p>
          <Button render={<a href={link.url} target="_blank" rel="noreferrer" />}>
            <ExternalLink /> Open
          </Button>
        </div>
      </Centered>
    )
  }
  return (
    <div className="flex size-full flex-col">
      <div className="flex items-center gap-2 border-b bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">From {PROVIDER_LABELS[link.provider]}. Blank, or asking you to sign in? It isn’t shared with you yet — open it in Google.</span>
        <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:underline">
          Open <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="relative min-h-0 flex-1 bg-white">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe src={link.embedUrl} title={name} onLoad={() => setLoaded(true)} className={cn('size-full border-0 transition-opacity', loaded ? 'opacity-100' : 'opacity-0')} allow="fullscreen" referrerPolicy="no-referrer-when-downgrade" />
      </div>
    </div>
  )
}

/** A Word document, read in the browser and shown in a locked-down frame (no scripts run). */
export function DocxViewer({ url }: { url: string }) {
  const result = useLoad(url, async () => {
    const buffer = await (await fetchBuffer(url)).arrayBuffer()
    const mammoth = await import('mammoth/mammoth.browser')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer })
    return value
  })
  if (result.error) return <Unreadable message={result.error} />
  if (result.value === undefined) return <Spinner />
  const doc = `<!doctype html><meta charset="utf-8"><base target="_blank"><style>
    body{font:15px/1.65 system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917;margin:0;padding:2rem 1.25rem 4rem}
    main{max-width:46rem;margin:0 auto}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #d6d3d1;padding:.35rem .6rem;vertical-align:top}h1,h2,h3{line-height:1.25}a{color:#0f5fa8}
  </style><main>${result.value || '<p style="color:#78716c">This document has no text.</p>'}</main>`
  return <iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} title="Document preview" className="size-full border-0 bg-white" />
}

type Grid = string[][]

/** Excel workbook: every sheet as a table. */
export function WorkbookViewer({ url }: { url: string }) {
  const result = useLoad(url, async () => {
    const blob = await (await fetchBuffer(url)).blob()
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const sheets = await readXlsxFile(blob)
    return sheets.map((s) => ({ name: s.sheet, rows: s.data.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : cell instanceof Date ? cell.toLocaleDateString() : String(cell)))) }))
  })
  const [active, setActive] = useState(0)
  if (result.error) return <Unreadable message={result.error} />
  if (!result.value) return <Spinner />
  const sheets = result.value
  const current = sheets[Math.min(active, sheets.length - 1)]
  return (
    <div className="flex size-full flex-col bg-background">
      {sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5" role="tablist">
          {sheets.map((s, i) => (
            <button key={s.name + i} role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-medium', i === active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted')}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <GridTable rows={current?.rows ?? []} />
    </div>
  )
}

/** Comma-separated values as a table. */
export function CsvViewer({ url }: { url: string }) {
  const result = useLoad(url, async () => parseCsv(await (await fetchBuffer(url)).text()))
  if (result.error) return <Unreadable message={result.error} />
  if (!result.value) return <Spinner />
  return <GridTable rows={result.value} />
}

const ROW_LIMIT = 1000

function GridTable({ rows }: { rows: Grid }) {
  if (rows.length === 0) return <Centered><p className="text-sm text-muted-foreground">This sheet is empty.</p></Centered>
  const shown = rows.slice(0, ROW_LIMIT)
  const width = Math.max(...shown.map((r) => r.length))
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-max border-separate border-spacing-0 text-xs">
        <tbody>
          {shown.map((row, r) => (
            <tr key={r}>
              <th scope="row" className="sticky left-0 w-10 min-w-10 border-r border-b bg-muted px-2 py-1 text-right font-normal text-muted-foreground tabular-nums">
                {r + 1}
              </th>
              {Array.from({ length: width }, (_, c) => (
                <td key={c} className={cn('max-w-72 truncate border-r border-b px-2 py-1 whitespace-nowrap', r === 0 && 'bg-muted/40 font-semibold')}>
                  {row[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > ROW_LIMIT && <p className="p-3 text-center text-xs text-muted-foreground">Showing the first {ROW_LIMIT} of {rows.length} rows. Download the file to see the rest.</p>}
    </div>
  )
}

function parseCsv(text: string): Grid {
  const rows: Grid = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const delimiter = (text.split('\n', 1)[0].match(/\t/g)?.length ?? 0) > (text.split('\n', 1)[0].match(/,/g)?.length ?? 0) ? '\t' : ','
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/**
 * Formats a browser can't draw (PowerPoint, old Word/Excel). A stored file can be opened in
 * Microsoft's viewer, but only if you say so: that sends them a temporary link to the file.
 */
export function OnlineViewerOffer({ file, url }: { file: Attachment; url: string }) {
  const [consent, setConsent] = useState(false)
  const canUseOnline = file.backend === 'storage'
  if (consent) {
    return <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} title={file.name} className="size-full border-0 bg-white" />
  }
  return (
    <Centered>
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <FileIcon category={file.name.match(/\.(ppt|pptx|odp|key)$/i) ? 'presentation' : 'document'} name={file.name} className="size-24 rounded-2xl" />
        <p className="text-sm text-muted-foreground">Browsers can’t draw this kind of file. Download it, or open it in its app.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />}>
            <ExternalLink /> Open
          </Button>
          <Button render={<a href={url} download={file.name} />}>Download</Button>
        </div>
        {canUseOnline && (
          <button type="button" onClick={() => setConsent(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            <ShieldQuestion className="size-3.5" /> Preview with Microsoft Office online (shares a temporary link)
          </button>
        )}
      </div>
    </Centered>
  )
}

function Unreadable({ message }: { message: string }) {
  return (
    <Centered>
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}. Try downloading it instead.</p>
    </Centered>
  )
}
