import type { SupabaseClient } from '@supabase/supabase-js'
import type { Attachment, FileStore, StoredFile } from '@/domain/attachments/Attachment'
import type { ID } from '@/domain/shared/types'
import { describeSupabaseError } from '@/data/supabase/errors'

const BUCKET = 'attachments'
/** Signed links last an hour; they're re-issued a little before that. */
const URL_TTL_SECONDS = 3600
const URL_REUSE_MS = 50 * 60 * 1000

/** Supabase Storage keys must be plain ASCII-safe; keep the original name in the record. */
const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-120) || 'file'

/** Bytes live in the private `attachments` bucket under `{user id}/{file id}/…`. */
export class SupabaseFileStore implements FileStore {
  private readonly urls = new Map<string, { url: string; at: number }>()

  constructor(private readonly supabase: SupabaseClient) {}

  async put(userId: ID, fileId: ID, file: Blob, name: string, onProgress?: (f: number) => void): Promise<StoredFile> {
    const path = `${userId}/${fileId}/${safeName(name)}`
    onProgress?.(0.1)
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (error) throw new Error(describeSupabaseError(error))
    onProgress?.(1)
    return { backend: 'storage', path }
  }

  async url(a: Attachment): Promise<string> {
    if (!a.path) throw new Error('This file has no storage location')
    const cached = this.urls.get(a.id)
    if (cached && Date.now() - cached.at < URL_REUSE_MS) return cached.url
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrl(a.path, URL_TTL_SECONDS)
    if (error) throw new Error(describeSupabaseError(error))
    this.urls.set(a.id, { url: data.signedUrl, at: Date.now() })
    return data.signedUrl
  }

  async remove(a: Attachment): Promise<void> {
    if (!a.path) return
    const { error } = await this.supabase.storage.from(BUCKET).remove([a.path])
    if (error) throw new Error(describeSupabaseError(error))
    this.urls.delete(a.id)
  }
}
