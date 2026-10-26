import type { LegalCase } from './LegalCase'
import type { OrganizationCode } from './Organization'

const PAD = 3

/**
 * The next case number for an organization in a year: `{ORG}-{YYYY}-{NNN}`, counting on from the
 * highest number already used for that organization and year (so deleting a case never makes a
 * number get reused out of order).
 */
export function nextCaseNumber(organization: OrganizationCode, year: number, existing: Pick<LegalCase, 'reference'>[]): string {
  const prefix = `${organization}-${year}-`
  const highest = existing.reduce((max, c) => {
    if (!c.reference.startsWith(prefix)) return max
    const n = Number(c.reference.slice(prefix.length))
    return Number.isInteger(n) ? Math.max(max, n) : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(PAD, '0')}`
}
