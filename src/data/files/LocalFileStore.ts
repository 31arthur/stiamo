import type { Attachment, FileStore, StoredFile } from '@/domain/attachments/Attachment'
import type { ID } from '@/domain/shared/types'

const DB_NAME = 'stiamo-files'
const STORE = 'files'

/** Keeps file bytes in this browser's IndexedDB (offline mode). Falls back to memory where IndexedDB is unavailable. */
export class LocalFileStore implements FileStore {
  private memory = new Map<string, Blob>()
  private urls = new Map<string, string>()
  private db: Promise<IDBDatabase | null>

  constructor() {
    this.db = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
  }

  async put(userId: ID, fileId: ID, file: Blob, _name: string, onProgress?: (f: number) => void): Promise<StoredFile> {
    const key = `${userId}/${fileId}`
    const db = await this.db
    if (db) await tx(db, 'readwrite', (s) => s.put(file, key))
    else this.memory.set(key, file)
    onProgress?.(1)
    return { backend: 'local', path: key }
  }

  async url(a: Attachment): Promise<string> {
    const key = a.path ?? `${a.userId}/${a.id}`
    const cached = this.urls.get(key)
    if (cached) return cached
    const db = await this.db
    const blob = db ? await tx<Blob | undefined>(db, 'readonly', (s) => s.get(key)) : this.memory.get(key)
    if (!blob) throw new Error('This file isn’t stored on this device')
    const url = URL.createObjectURL(blob)
    this.urls.set(key, url)
    return url
  }

  async remove(a: Attachment): Promise<void> {
    const key = a.path ?? `${a.userId}/${a.id}`
    const db = await this.db
    if (db) await tx(db, 'readwrite', (s) => s.delete(key))
    this.memory.delete(key)
  }
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}
