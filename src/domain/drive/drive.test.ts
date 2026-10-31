import { describe, expect, it } from 'vitest'
import { casesForFile, caseSearchTerms, driveFileAsAttachment, driveFileId, isGoogleDoc, NO_DRIVE } from './Drive'

describe('what identifies a case in a letter', () => {
  it('uses our number, the court’s number, the title, the client and the other side', () => {
    expect(caseSearchTerms({ reference: 'TUMWU-2026-001', courtNumber: 'WP 1290/2026', title: 'Alur 84 Workers NHAI Case', client: 'Workers of Alur', opposingParty: 'NHAI' })).toEqual([
      'TUMWU-2026-001',
      'WP 1290/2026',
      'Alur 84 Workers NHAI Case',
      'Workers of Alur',
      'NHAI',
    ])
  })

  it('leaves out what is missing, too short to mean anything, or repeated', () => {
    expect(caseSearchTerms({ reference: 'SA-2026-004', title: '  Wages   case  ', client: 'wages case', opposingParty: 'AB' })).toEqual(['SA-2026-004', 'Wages case'])
  })
})

describe('Drive addresses', () => {
  it('finds the file id however the link is spelled', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUv'
    expect(driveFileId(`https://drive.google.com/file/d/${id}/view?usp=drivesdk`)).toBe(id)
    expect(driveFileId(`https://docs.google.com/document/d/${id}/edit`)).toBe(id)
    expect(driveFileId(`https://drive.google.com/open?id=${id}`)).toBe(id)
    expect(driveFileId('https://example.com/letter.pdf')).toBeUndefined()
    expect(driveFileId(undefined)).toBeUndefined()
  })

  it('tells native Google documents from uploaded files', () => {
    expect(isGoogleDoc('application/vnd.google-apps.document')).toBe(true)
    expect(isGoogleDoc('application/pdf')).toBe(false)
  })
})

describe('without the backend', () => {
  it('says Drive search is unavailable instead of failing', async () => {
    expect((await NO_DRIVE.status()).available).toBe(false)
    expect(await NO_DRIVE.suggest(['x'])).toEqual([])
    await expect(NO_DRIVE.search('x')).rejects.toThrow(/backend/)
  })
})

describe('previewing a Drive file in place', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUv'
  it('shows it through Google’s own viewer', () => {
    const a = driveFileAsAttachment({ id, name: 'Notice.pdf', mimeType: 'application/pdf', webViewLink: `https://drive.google.com/file/d/${id}/view` }, 'u1')
    expect(a?.link?.embedUrl).toBe(`https://drive.google.com/file/d/${id}/preview`)
    expect(a?.name).toBe('Notice.pdf')
  })
  it('has nothing to show without a link', () => {
    expect(driveFileAsAttachment({ id, name: 'x', mimeType: 'application/pdf' }, 'u1')).toBeNull()
  })
})

describe('which case a file belongs to', () => {
  const c = (reference: string, status: 'active' | 'closed', createdAt: string, courtNumber?: string) => ({ reference, courtNumber, title: reference, status, createdAt }) as const
  it('puts the cases the file name mentions first, then open matters, newest first', () => {
    const list = [c('SA-2026-001', 'closed', '2026-01-01'), c('SA-2026-002', 'active', '2026-02-01'), c('SA-2026-003', 'active', '2026-03-01', 'WP 1290/2026')]
    const out = casesForFile('Order in wp 1290/2026.pdf', list)
    expect(out.map((o) => o.case.reference)).toEqual(['SA-2026-003', 'SA-2026-002', 'SA-2026-001'])
    expect(out.map((o) => o.suggested)).toEqual([true, false, false])
  })
})
