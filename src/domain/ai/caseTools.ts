import { CASE_STATUS_LABELS, caseTypeOf, CASE_TYPES, hearingsOf, nextHearing } from '../cases/LegalCase'
import type { Hearing, LegalCase } from '../cases/LegalCase'
import { caseSearchTerms, driveFileId } from '../drive/Drive'
import type { DriveApi, DriveFile } from '../drive/Drive'
import type { Attachment } from '../attachments/Attachment'
import type { ISODate } from '../shared/types'
import type { CaseHit, DocumentHit, Found, Tool } from './agent'

export interface CaseToolsData {
  cases: LegalCase[]
  hearings: Hearing[]
  attachments: Attachment[]
  drive: DriveApi
  /** Whether the Drive can be searched at all (it needs the backend). */
  driveAvailable: boolean
  today: ISODate
}

const STATUSES = Object.keys(CASE_STATUS_LABELS)

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const clampLimit = (v: unknown, fallback: number) => Math.min(25, Math.max(1, typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback))

/** Everything about a case that a person might type to find it. */
const haystack = (c: LegalCase) =>
  [c.reference, c.courtNumber, c.title, c.client, c.opposingParty, c.court, c.stage, c.practiceArea, CASE_TYPES[caseTypeOf(c.type)].label, c.summary].filter(Boolean).join(' ').toLowerCase()

/** Cases that contain every word of the query; if none do, the ones that contain the most of them. */
export function matchCases(cases: LegalCase[], query: string): LegalCase[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
  if (words.length === 0) return cases
  const scored = cases.map((c) => ({ c, hits: words.filter((w) => haystack(c).includes(w)).length })).filter((x) => x.hits > 0)
  const best = Math.max(0, ...scored.map((x) => x.hits))
  const full = scored.filter((x) => x.hits === words.length)
  return (full.length ? full : scored.filter((x) => x.hits === best)).sort((a, b) => b.hits - a.hits).map((x) => x.c)
}

/** The case tools: finding cases, reading one, and finding the documents that belong with it. */
export function buildCaseTools(d: CaseToolsData): Tool[] {
  const hit = (c: LegalCase): CaseHit => {
    const next = nextHearing(c.id, d.hearings, d.today)
    return {
      id: c.id,
      reference: c.reference,
      title: c.title,
      status: CASE_STATUS_LABELS[c.status],
      court: c.court,
      courtNumber: c.courtNumber,
      client: c.client,
      opposingParty: c.opposingParty,
      stage: c.stage,
      nextHearing: next && { date: next.date, purpose: next.purpose },
    }
  }
  const caseCards = (list: LegalCase[]): Found[] => list.map((c) => ({ kind: 'case', ...hit(c) }))

  /** Cases a Drive file is already filed under, by case reference. */
  const filedUnder = (file: DriveFile): string[] =>
    d.attachments.flatMap((a) => (a.owner.kind === 'case' && driveFileId(a.link?.url) === file.id ? (d.cases.find((c) => c.id === a.owner.id)?.reference ?? []) : []))

  const docCard = (f: DriveFile, extra: Partial<DocumentHit> = {}): Found => ({ kind: 'document', ...f, filedUnder: filedUnder(f), ...extra })
  const noDrive = { error: 'Google Drive is not connected, so documents cannot be searched.' }

  return [
    {
      name: 'search_cases',
      description: 'Find cases. Matches the words against the case number, the court’s number, title, client, opposing party, court, stage and summary. With no query it lists cases, optionally only those with a given status.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to look for, e.g. "NHAI Alur" or "WP 1290/2026".' },
          status: { type: 'string', enum: STATUSES, description: 'Only cases with this status.' },
          limit: { type: 'integer', description: 'How many to return (default 10, at most 25).' },
        },
      },
      label: (a) => (text(a.query) ? `Searched cases for “${text(a.query)}”` : 'Listed cases'),
      async run(a) {
        const status = text(a.status)
        const pool = status && STATUSES.includes(status) ? d.cases.filter((c) => c.status === status) : d.cases
        const found = matchCases(pool, text(a.query)).slice(0, clampLimit(a.limit, 10))
        return { result: { count: found.length, cases: found.map(hit) }, found: caseCards(found) }
      },
    },
    {
      name: 'get_case',
      description: 'Everything on one case: its details, summary, hearings (with dates and purposes) and the documents filed under it. Use the id from search_cases.',
      parameters: { type: 'object', properties: { id: { type: 'string', description: 'The case id.' } }, required: ['id'] },
      label: (a) => `Opened case ${text(a.id)}`,
      async run(a) {
        const c = d.cases.find((x) => x.id === text(a.id) || x.reference === text(a.id))
        if (!c) return { result: { error: 'No case has that id. Search for it first.' } }
        const filed = d.attachments.filter((x) => x.owner.kind === 'case' && x.owner.id === c.id && x.link)
        return {
          result: {
            ...hit(c),
            summary: c.summary,
            filedOn: c.filedOn,
            hearings: hearingsOf(c.id, d.hearings).map((h) => ({ date: h.date, purpose: h.purpose, recorded: h.outcome.status !== 'open', order: h.order })),
            documents: filed.map((x) => ({ name: x.name, link: x.link?.url })),
          },
          found: caseCards([c]),
        }
      },
    },
    {
      name: 'case_documents',
      description: 'The documents that belong with a case: those already filed under it, and letters in the Google Drive that mention its number, court number, title or parties.',
      parameters: { type: 'object', properties: { id: { type: 'string', description: 'The case id.' } }, required: ['id'] },
      label: (a) => `Looked for documents on case ${text(a.id)}`,
      async run(a) {
        const c = d.cases.find((x) => x.id === text(a.id) || x.reference === text(a.id))
        if (!c) return { result: { error: 'No case has that id. Search for it first.' } }
        const filed = d.attachments.filter((x) => x.owner.kind === 'case' && x.owner.id === c.id && x.link)
        const filedDocs: Found[] = filed.map((x) => ({ kind: 'document', id: driveFileId(x.link!.url) ?? x.id, name: x.name, mimeType: x.mime, webViewLink: x.link!.url, modifiedTime: x.createdAt, filedUnder: [c.reference] }))
        let suggested: Found[] = []
        if (d.driveAvailable) {
          const terms = caseSearchTerms(c)
          const matches = terms.length ? await d.drive.suggest(terms) : []
          const have = new Set(filedDocs.map((f) => f.id))
          suggested = matches.filter((m) => !have.has(m.id)).slice(0, 8).map((m) => docCard(m, { matched: m.matched }))
        }
        const docs = [...filedDocs, ...suggested]
        return {
          result: {
            case: c.reference,
            filed: filedDocs.map((f) => (f.kind === 'document' ? f.name : '')),
            suggestedFromDrive: suggested.map((f) => (f.kind === 'document' ? { name: f.name, matched: f.matched, modifiedTime: f.modifiedTime } : null)),
            driveConnected: d.driveAvailable,
          },
          found: docs,
        }
      },
    },
    {
      name: 'find_documents',
      description: 'Search the letters and documents in the Google Drive by what is in them (names and contents). Every word must appear. Newest first when no words are given.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Words in the document, e.g. "wage breakdown Alur". Put a phrase in quotes.' }, limit: { type: 'integer', description: 'How many (default 8, at most 25).' } },
      },
      label: (a) => (text(a.query) ? `Searched Drive for “${text(a.query)}”` : 'Looked at the newest documents in Drive'),
      async run(a) {
        if (!d.driveAvailable) return { result: noDrive }
        const page = await d.drive.search(text(a.query))
        const files = page.items.slice(0, clampLimit(a.limit, 8))
        return { result: { count: files.length, documents: files.map((f) => ({ name: f.name, modifiedTime: f.modifiedTime, filedUnder: filedUnder(f) })) }, found: files.map((f) => docCard(f)) }
      },
    },
  ]
}

/** The agent's standing instructions. */
export const caseAgentPrompt = (today: ISODate) =>
  [
    'You are the case assistant inside Stiamo, the practice-management app of a small legal practice (S&B Consultants).',
    'Answer questions about their cases and the documents that go with them, using the tools. Never guess: if a tool finds nothing, say so.',
    'Find cases with search_cases (try the parties, the case number or the court number), read one with get_case, and find its documents with case_documents. Use find_documents to search the Drive directly.',
    'Whatever the tools find is shown to the person as cards beneath your answer, so do not repeat long lists: answer briefly, name cases by their reference number, and point out what matters (the next hearing, a missing document).',
    `Today is ${today}. Reply in plain language, in a few short sentences.`,
  ].join('\n')
