import type { Entity, EntityRef, ID } from '../shared/types'

/** Where the bytes live: Supabase Storage, this browser, or nowhere — a link to a document kept elsewhere. */
export type FileBackend = 'storage' | 'local' | 'link'

/** Where a linked document lives. Google's own files can be shown in place; anything else opens in a new tab. */
export type LinkProvider = 'google-doc' | 'google-sheet' | 'google-slides' | 'google-drive' | 'google-folder' | 'google-form' | 'web'

export interface DocumentLink {
  /** What was pasted. */
  url: string
  provider: LinkProvider
  /** An address that can be framed to show the document inside the app, when the provider allows it. */
  embedUrl?: string
}

/** A supporting document attached to a record: an order sheet, a contract, a photo, a recording… or a link to a Google Doc. */
export interface Attachment extends Entity {
  owner: EntityRef
  name: string
  mime: string
  size: number
  backend: FileBackend
  /** Object path for the storage backend. */
  path?: string
  /** Set for linked documents, which have no stored bytes. */
  link?: DocumentLink
  caption?: string
}

export interface StoredFile {
  backend: FileBackend
  path?: string
}

/** Port for the file bytes. */
export interface FileStore {
  put(userId: ID, fileId: ID, file: Blob, name: string, onProgress?: (fraction: number) => void): Promise<StoredFile>
  /** A URL the browser can display or download. */
  url(attachment: Attachment): Promise<string>
  remove(attachment: Attachment): Promise<void>
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export const LINK_MIME = 'text/uri-list'

export type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'link' | 'other'

export function categorize(mime: string, name: string): FileCategory {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/') || ['json', 'md', 'csv', 'txt', 'log', 'xml', 'yml', 'yaml'].includes(ext)) return 'text'
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return 'document'
  if (['xls', 'xlsx', 'ods', 'numbers'].includes(ext)) return 'spreadsheet'
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'presentation'
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return 'archive'
  return 'other'
}

/** What kind of thing an attachment is, for its icon and how it's previewed. Links are their own kind. */
export const categoryOf = (a: Pick<Attachment, 'mime' | 'name' | 'link'>): FileCategory => (a.link ? 'link' : categorize(a.mime, a.name))

export const PROVIDER_LABELS: Record<LinkProvider, string> = {
  'google-doc': 'Google Doc',
  'google-sheet': 'Google Sheet',
  'google-slides': 'Google Slides',
  'google-drive': 'Google Drive file',
  'google-folder': 'Google Drive folder',
  'google-form': 'Google Form',
  web: 'Web link',
}

const GOOGLE_ID = '[\\w-]{15,}'
const route = (host: string, path: string) => new RegExp(`^https://${host}/${path}`)

/**
 * Works out what a pasted address is and, for Google's documents, the address that shows it inside
 * the app. Only http(s) addresses are accepted. Documents show to anyone Google would let open them:
 * shared "anyone with the link", or shared with the Google account the viewer is signed in to.
 */
export function describeLink(input: string): DocumentLink | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const clean = `https://${url.host}${url.pathname}`
  const at = (re: RegExp) => re.exec(clean)?.[1]

  const doc = at(route('docs\\.google\\.com', `document/(?:u/\\d+/)?d/(${GOOGLE_ID})`))
  if (doc) return { url: url.toString(), provider: 'google-doc', embedUrl: `https://docs.google.com/document/d/${doc}/preview` }

  const sheet = at(route('docs\\.google\\.com', `spreadsheets/(?:u/\\d+/)?d/(${GOOGLE_ID})`))
  if (sheet) return { url: url.toString(), provider: 'google-sheet', embedUrl: `https://docs.google.com/spreadsheets/d/${sheet}/preview` }

  const slides = at(route('docs\\.google\\.com', `presentation/(?:u/\\d+/)?d/(${GOOGLE_ID})`))
  if (slides) return { url: url.toString(), provider: 'google-slides', embedUrl: `https://docs.google.com/presentation/d/${slides}/preview` }

  const form = at(route('docs\\.google\\.com', `forms/(?:u/\\d+/)?d/(?:e/)?(${GOOGLE_ID})`))
  if (form) return { url: url.toString(), provider: 'google-form' }

  const file = at(route('drive\\.google\\.com', `file/(?:u/\\d+/)?d/(${GOOGLE_ID})`))
  if (file) return { url: url.toString(), provider: 'google-drive', embedUrl: `https://drive.google.com/file/d/${file}/preview` }

  const folder = at(route('drive\\.google\\.com', `drive/(?:u/\\d+/)?folders/(${GOOGLE_ID})`))
  if (folder) return { url: url.toString(), provider: 'google-folder', embedUrl: `https://drive.google.com/embeddedfolderview?id=${folder}#list` }
  const openId = url.host === 'drive.google.com' && url.pathname === '/open' ? url.searchParams.get('id') : null
  if (openId && new RegExp(`^${GOOGLE_ID}$`).test(openId)) return { url: url.toString(), provider: 'google-drive', embedUrl: `https://drive.google.com/file/d/${openId}/preview` }

  // A direct link to a PDF can be framed as it is.
  if (url.protocol === 'https:' && /\.pdf$/i.test(url.pathname)) return { url: url.toString(), provider: 'web', embedUrl: url.toString() }
  return { url: url.toString(), provider: 'web' }
}

/** A name to show when the person doesn't give one. */
export function defaultLinkName(link: DocumentLink): string {
  if (link.provider !== 'web') return PROVIDER_LABELS[link.provider]
  const u = new URL(link.url)
  const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
  return last || u.host.replace(/^www\./, '')
}
