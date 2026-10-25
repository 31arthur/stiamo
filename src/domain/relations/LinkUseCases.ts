import type { ActivityLog } from '../activity/ActivityLog'
import { KIND_LABEL } from '../activity/describe'
import { required, ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import { sameRef } from '../shared/types'
import type { EntityRef, ID } from '../shared/types'
import type { Link } from './Link'
import { linkTouches } from './Link'

/** Hand-made connections between any two records, and free-form notes on a record's thread. */
export class LinkUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly log: ActivityLog,
  ) {}

  async link(userId: ID, a: EntityRef, b: EntityRef, titles: { a: string; b: string }, note?: string): Promise<Link> {
    if (sameRef(a, b)) throw new ValidationError('A record can’t be linked to itself')
    const existing = (await this.env.repos.link.list(userId)).find((l) => linkTouches(l, a) && linkTouches(l, b))
    if (existing) return existing
    const now = this.env.clock.now().toISOString()
    const link: Link = { id: this.env.ids.next(), userId, a, b, note: note?.trim() || undefined, createdAt: now, updatedAt: now }
    await this.env.repos.link.save(link)
    await this.log.record(userId, { ref: a, title: titles.a, action: 'linked', summary: `Linked to ${KIND_LABEL[b.kind].toLowerCase()} “${titles.b}”`, related: b })
    await this.log.record(userId, { ref: b, title: titles.b, action: 'linked', summary: `Linked to ${KIND_LABEL[a.kind].toLowerCase()} “${titles.a}”`, related: a })
    return link
  }

  async unlink(userId: ID, linkId: ID, titles: { a: string; b: string }): Promise<void> {
    const link = await this.env.repos.link.get(userId, linkId)
    if (!link) return
    await this.env.repos.link.remove(userId, linkId)
    await this.log.record(userId, { ref: link.a, title: titles.a, action: 'unlinked', summary: `Unlinked from “${titles.b}”`, related: link.b })
    await this.log.record(userId, { ref: link.b, title: titles.b, action: 'unlinked', summary: `Unlinked from “${titles.a}”`, related: link.a })
  }

  /** A note on the record's thread — a call summary, a thought, a decision. */
  addNote(userId: ID, ref: EntityRef, title: string, text: string): Promise<void> {
    return this.log.record(userId, { ref, title, action: 'note', summary: required(text, 'Note') })
  }
}
