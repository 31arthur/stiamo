import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'
import type { Attachment, FileStore, StoredFile } from '@/domain/attachments/Attachment'
import type { ID } from '@/domain/shared/types'
import { describeFirebaseError, firebaseCode } from '@/data/firebase/errors'

/** Firestore documents max out at 1 MiB; 700 KB of bytes is ~930 KB as base64. */
const CHUNK_BYTES = 700 * 1024
const INLINE_LIMIT = 10 * 1024 * 1024
const UNAVAILABLE_KEY = 'stiamo.storage-unavailable'

/** Errors that mean "Cloud Storage isn't set up for this project" rather than "this upload failed". */
const STORAGE_MISSING = new Set(['storage/unknown', 'storage/bucket-not-found', 'storage/project-not-found', 'storage/no-default-bucket'])

/**
 * Stores bytes in Cloud Storage when the project has a bucket; otherwise (e.g. on the free plan)
 * falls back to chunked documents in Firestore so attachments still work and still sync.
 */
export class FirebaseFileStore implements FileStore {
  private urls = new Map<string, string>()

  constructor(
    private readonly storage: FirebaseStorage,
    private readonly db: Firestore,
  ) {
    storage.maxUploadRetryTime = 20_000
    storage.maxOperationRetryTime = 20_000
  }

  async put(userId: ID, fileId: ID, file: Blob, name: string, onProgress?: (f: number) => void): Promise<StoredFile> {
    if (!sessionStorage.getItem(UNAVAILABLE_KEY)) {
      const path = `users/${userId}/attachments/${fileId}/${name}`
      try {
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(ref(this.storage, path), file, { contentType: file.type || undefined })
          task.on('state_changed', (s) => onProgress?.(s.bytesTransferred / s.totalBytes), reject, () => resolve())
        })
        return { backend: 'storage', path }
      } catch (error) {
        if (!STORAGE_MISSING.has(firebaseCode(error) ?? '')) throw new Error(describeFirebaseError(error))
        sessionStorage.setItem(UNAVAILABLE_KEY, '1')
      }
    }
    return this.putInline(userId, fileId, file, onProgress)
  }

  private async putInline(userId: ID, fileId: ID, file: Blob, onProgress?: (f: number) => void): Promise<StoredFile> {
    if (file.size > INLINE_LIMIT) {
      throw new Error('Files over 10 MB need Cloud Storage. Enable Storage in the Firebase console (it requires the Blaze plan).')
    }
    const chunks = Math.ceil(file.size / CHUNK_BYTES)
    const col = collection(this.db, 'users', userId, 'fileChunks')
    for (let i = 0; i < chunks; i += 8) {
      const batch = writeBatch(this.db)
      for (let j = i; j < Math.min(chunks, i + 8); j++) {
        const data = await toBase64(file.slice(j * CHUNK_BYTES, (j + 1) * CHUNK_BYTES))
        batch.set(doc(col, `${fileId}_${j}`), { fileId, index: j, data })
      }
      try {
        await batch.commit()
      } catch (error) {
        throw new Error(describeFirebaseError(error))
      }
      onProgress?.(Math.min(1, (i + 8) / chunks))
    }
    return { backend: 'inline', chunks }
  }

  async url(a: Attachment): Promise<string> {
    const cached = this.urls.get(a.id)
    if (cached) return cached
    let url: string
    if (a.backend === 'storage' && a.path) {
      url = await getDownloadURL(ref(this.storage, a.path))
    } else {
      const snap = await getDocs(query(collection(this.db, 'users', a.userId, 'fileChunks'), where('fileId', '==', a.id)))
      const parts = snap.docs.map((d) => d.data() as { index: number; data: string }).sort((x, y) => x.index - y.index)
      if (!parts.length) throw new Error('File content not found')
      url = URL.createObjectURL(new Blob(parts.map((p) => fromBase64(p.data)), { type: a.mime }))
    }
    this.urls.set(a.id, url)
    return url
  }

  async remove(a: Attachment): Promise<void> {
    if (a.backend === 'storage' && a.path) return deleteObject(ref(this.storage, a.path))
    const batch = writeBatch(this.db)
    for (let i = 0; i < (a.chunks ?? 0); i++) batch.delete(doc(this.db, 'users', a.userId, 'fileChunks', `${a.id}_${i}`))
    await batch.commit()
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
