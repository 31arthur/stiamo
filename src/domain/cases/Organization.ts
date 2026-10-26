/** The organizations on whose behalf cases are filed. The code prefixes each case number. */
export type OrganizationCode = 'NUMW' | 'TUMWU' | 'PMLU' | 'MRC' | 'TYP' | 'SA'

export interface Organization {
  code: OrganizationCode
  name: string
}

export const ORGANIZATIONS: Record<OrganizationCode, Organization> = {
  NUMW: { code: 'NUMW', name: 'National Union for Migrant Workers' },
  TUMWU: { code: 'TUMWU', name: 'Telangana Unorganized and Migrant Workers Union' },
  PMLU: { code: 'PMLU', name: 'Palamooru Migrant Labour Union' },
  MRC: { code: 'MRC', name: 'Migrants Rights Council' },
  TYP: { code: 'TYP', name: 'The Youth Project' },
  SA: { code: 'SA', name: 'Samrat & Associates' },
}

export const ORGANIZATION_CODES = Object.keys(ORGANIZATIONS) as OrganizationCode[]

export const organizationName = (code: string | undefined) => (code && ORGANIZATIONS[code as OrganizationCode]?.name) || code || '—'
