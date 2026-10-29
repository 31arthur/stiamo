import { describe, expect, it } from 'vitest'
import { caseSearchTerms, driveFileId, isGoogleDoc, NO_DRIVE } from './Drive'

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
