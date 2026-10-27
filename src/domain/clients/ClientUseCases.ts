import type { CrudUseCases } from '../shared/CrudUseCases'
import type { DomainEnv } from '../shared/registry'
import type { ID } from '../shared/types'

export class ClientUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly clients: CrudUseCases<'client'>,
    private readonly projects: CrudUseCases<'project'>,
  ) {}

  /**
   * Deletes a client along with its projects. Meetings, tasks and documents that pointed at them
   * stay, just no longer tied to anyone.
   */
  async remove(userId: ID, clientId: ID): Promise<void> {
    for (const p of await this.env.repos.project.list(userId)) {
      if (p.clientId === clientId) await this.projects.remove(userId, p.id)
    }
    await this.clients.remove(userId, clientId)
  }
}
