import type { ActivityLog } from '../activity/ActivityLog'
import type { CrudUseCases } from '../shared/CrudUseCases'
import type { DomainEnv } from '../shared/registry'
import type { ID } from '../shared/types'

export class CounselUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly counsel: CrudUseCases<'counsel'>,
    private readonly cases: CrudUseCases<'case'>,
    private readonly log: ActivityLog,
  ) {}

  /** Deletes counsel; cases they were briefed on go back to being handled by us, with a note. */
  async remove(userId: ID, counselId: ID): Promise<void> {
    const counsel = await this.env.repos.counsel.get(userId, counselId)
    const engaged = (await this.env.repos.case.list(userId)).filter((c) => c.engagement?.counselId === counselId)
    for (const c of engaged) {
      await this.cases.update({ ...c, engagement: undefined })
      await this.log.record(userId, {
        ref: { kind: 'case', id: c.id },
        title: `${c.reference} — ${c.title}`,
        action: 'updated',
        summary: `${counsel?.name ?? 'Counsel'} was removed from the directory — now handled by us`,
      })
    }
    await this.counsel.remove(userId, counselId)
  }
}
