import type { LegalCase } from '../cases/LegalCase'

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
}

/** Used when there is no backend to search through (offline, Supabase). */
export const NO_DRIVE: DriveApi = {
  status: async () => ({ available: false, reason: 'Drive search needs the Stiamo backend.' }),
  search: () => Promise.reject(new Error('Drive search needs the Stiamo backend.')),
  suggest: async () => [],
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
