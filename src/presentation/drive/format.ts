import { format, parseISO } from 'date-fns'
import { driveFileId } from '@/domain/drive/Drive'

export const driveDate = (iso?: string) => (iso ? format(parseISO(iso), 'd MMM yyyy') : '')

/** The Drive file ids among a record's attachments. */
export const attachedDriveIds = (links: (string | undefined)[]) => new Set(links.map(driveFileId).filter((id): id is string => !!id))
