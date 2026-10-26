import type { Entity, EntityRef, ID } from '../shared/types'

/** Where the bytes live. Metadata always lives with the rest of the user's data. */
export type FileBackend = 'storage' | 'local'

/** A supporting document attached to a record: an order sheet, a contract, a photo, a recording… */
export interface Attachment extends Entity {
  owner: EntityRef
  name: string
  mime: string
  size: number
  backend: FileBackend
  /** Object path for the storage backend. */
  path?: string
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

export type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'other'

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
