import { describeLink, LINK_MIME } from '../attachments/Attachment'
import type { Attachment } from '../attachments/Attachment'
import type { LegalCase } from '../cases/LegalCase'
import type { ID } from '../shared/types'

/** A file in the owner's Google Drive. Only this description ever reaches Stiamo; the file itself stays in Drive. */
export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  /** Opens the file in Google's own viewer; this is what gets attached to a record. */
  webViewLink?: string
  size?: number
}

/** A file suggested for a record, with the details of the record it mentions. */
export interface DriveMatch extends DriveFile {
  matched: string[]
}

export interface DriveStatus {
  available: boolean
  /** The shared folder's name. */
  folder?: string
  /** Why it can't be used, in words for people. */
  reason?: string
}

export interface DrivePage {
  items: DriveFile[]
  nextPageToken?: string
}

/** Searching the Drive's file names and contents. Nothing is copied; Google does the searching. */
export interface DriveApi {
  status(): Promise<DriveStatus>
  /** Every word must appear in a file's name or contents; "quoted phrases" stay together. Empty lists the newest files. */
  search(query: string, pageToken?: string): Promise<DrivePage>
  /** Files that mention any of these details (a case number, a court number, a party…), best first. */
  suggest(terms: string[]): Promise<DriveMatch[]>
  /** The file itself, fetched by the backend with its own Google access: no Google sign-in is needed to view it. Google's documents arrive as PDF or xlsx. */
  content(fileId: string): Promise<Blob>
}

/** Used when there is no backend to search through (offline, Supabase). */
export const NO_DRIVE: DriveApi = {
  status: async () => ({ available: false, reason: 'Drive search needs the Stiamo backend.' }),
  search: () => Promise.reject(new Error('Drive search needs the Stiamo backend.')),
  suggest: async () => [],
  content: () => Promise.reject(new Error('Drive search needs the Stiamo backend.')),
}

/** What identifies a case in a letter: our case number, the court's number, its title, the client and the other side. */
export function caseSearchTerms(c: Pick<LegalCase, 'reference' | 'courtNumber' | 'title' | 'client' | 'opposingParty'>): string[] {
  const seen = new Set<string>()
  return [c.reference, c.courtNumber, c.title, c.client, c.opposingParty]
    .map((t) => t?.replace(/\s+/g, ' ').trim() ?? '')
    .filter((t) => t.length >= 3 && !seen.has(t.toLowerCase()) && !!seen.add(t.toLowerCase()))
}

/** The Drive file id inside an address, so a file isn't attached twice under different spellings of its link. */
export function driveFileId(address: string | undefined): string | undefined {
  if (!address) return undefined
  return /\/d\/([\w-]{15,})/.exec(address)?.[1] ?? /[?&]id=([\w-]{15,})/.exec(address)?.[1]
}

export const isGoogleDoc = (mime: string) => mime.startsWith('application/vnd.google-apps.')

/** A Drive file shaped like an attachment, so it can be previewed in place without being linked to anything. */
export function driveFileAsAttachment(f: DriveFile, userId: ID): Attachment | null {
  const link = f.webViewLink ? describeLink(f.webViewLink) : null
  if (!link) return null
  const at = f.modifiedTime ?? new Date(0).toISOString()
  return { id: f.id, userId, owner: { kind: 'case', id: '' }, name: f.name, mime: LINK_MIME, size: f.size ?? 0, backend: 'link', link, createdAt: at, updatedAt: at }
}

/**
 * Cases to offer for a file, those it looks like it belongs to first: the file's name mentions the case's number,
 * the court's number or the case title. Otherwise open matters come before closed ones, newest first.
 */
export function casesForFile<C extends Pick<LegalCase, 'reference' | 'courtNumber' | 'title' | 'status' | 'createdAt'>>(fileName: string, cases: C[]): { case: C; suggested: boolean }[] {
  const name = fileName.toLowerCase()
  const mentions = (c: C) => [c.reference, c.courtNumber].some((t) => !!t && t.length >= 3 && name.includes(t.toLowerCase()))
  const open = (c: C) => (c.status === 'active' || c.status === 'on_hold' ? 0 : 1)
  return cases
    .map((c) => ({ case: c, suggested: mentions(c) }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || open(a.case) - open(b.case) || b.case.createdAt.localeCompare(a.case.createdAt))
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

/** A Google document is exported, so its name needs the extension of what arrived for it to be shown the right way. */
export function nameForContent(name: string, mime: string): string {
  const ext = EXTENSIONS[mime]
  return ext && !name.toLowerCase().endsWith(`.${ext}`) ? `${name}.${ext}` : name
}

export type FileKind = 'doc' | 'sheet' | 'slides' | 'pdf' | 'word' | 'excel' | 'image' | 'other'

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  doc: 'Google Doc',
  sheet: 'Google Sheet',
  slides: 'Google Slides',
  pdf: 'PDF',
  word: 'Word document',
  excel: 'Excel workbook',
  image: 'Image',
  other: 'File',
}

/** What a Drive file is, for its icon and for filtering: Google's own documents, Office files, PDFs, pictures. */
export function fileKind(mime: string, name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime === 'application/vnd.google-apps.document') return 'doc'
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'sheet'
  if (mime === 'application/vnd.google-apps.presentation') return 'slides'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('word') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'word'
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime === 'text/csv' || ['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'excel'
  return 'other'
}
