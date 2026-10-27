import type { ActivityLog } from '../activity/ActivityLog'
import { ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { EntityRef, ID } from '../shared/types'
import type { Attachment, FileStore } from './Attachment'
import { defaultLinkName, describeLink, LINK_MIME, MAX_ATTACHMENT_BYTES } from './Attachment'

const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/** Attach supporting documents to any record, and remove them. Both are written to the record's history. */
export class AttachmentUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly files: FileStore,
    private readonly log: ActivityLog,
  ) {}

  async attach(userId: ID, owner: EntityRef, ownerTitle: string, file: File, onProgress?: (fraction: number) => void): Promise<Attachment> {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new ValidationError(`“${file.name}” is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}`)
    if (file.size === 0) throw new ValidationError(`“${file.name}” is empty`)
    const id = this.env.ids.next()
    const stored = await this.files.put(userId, id, file, file.name, onProgress)
    const now = this.env.clock.now().toISOString()
    const attachment: Attachment = {
      id,
      userId,
      owner,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      ...stored,
      createdAt: now,
      updatedAt: now,
    }
    await this.env.repos.attachment.save(attachment)
    await this.log.record(userId, { ref: owner, title: ownerTitle, action: 'attached', summary: `Attached “${file.name}” (${formatBytes(file.size)})` })
    return attachment
  }

  /** Attaches a document that lives elsewhere (a Google Doc, a shared PDF…): nothing is stored, the link is. */
  async attachLink(userId: ID, owner: EntityRef, ownerTitle: string, address: string, name?: string): Promise<Attachment> {
    const link = describeLink(address)
    if (!link) throw new ValidationError('Paste a full web address, starting with https://')
    const id = this.env.ids.next()
    const now = this.env.clock.now().toISOString()
    const title = name?.trim() || defaultLinkName(link)
    const attachment: Attachment = { id, userId, owner, name: title, mime: LINK_MIME, size: 0, backend: 'link', link, createdAt: now, updatedAt: now }
    await this.env.repos.attachment.save(attachment)
    await this.log.record(userId, { ref: owner, title: ownerTitle, action: 'attached', summary: `Linked “${title}”` })
    return attachment
  }

  async remove(userId: ID, attachment: Attachment, ownerTitle: string): Promise<void> {
    if (!attachment.link) await this.files.remove(attachment).catch(() => undefined)
    await this.env.repos.attachment.remove(userId, attachment.id)
    await this.log.record(userId, { ref: attachment.owner, title: ownerTitle, action: 'detached', summary: `Removed “${attachment.name}”` })
  }

  rename(attachment: Attachment, caption: string): Promise<Attachment> {
    return this.env.repos.attachment.save({ ...attachment, caption: caption.trim() || undefined, updatedAt: this.env.clock.now().toISOString() })
  }

  url(attachment: Attachment): Promise<string> {
    return attachment.link ? Promise.resolve(attachment.link.url) : this.files.url(attachment)
  }
}
