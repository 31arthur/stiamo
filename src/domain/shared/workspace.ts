/** The areas of life and practice that work belongs to. */
export type WorkspaceId = 'personal' | 'sb' | 'fsa' | 'media'

export interface WorkspaceInfo {
  id: WorkspaceId
  name: string
  short: string
  domain: string
}

export const WORKSPACES: Record<WorkspaceId, WorkspaceInfo> = {
  personal: { id: 'personal', name: 'Personal', short: 'Personal', domain: 'Life' },
  sb: { id: 'sb', name: 'S&B Consultants', short: 'S&B', domain: 'Legal' },
  fsa: { id: 'fsa', name: 'FSA', short: 'FSA', domain: 'Tech' },
  media: { id: 'media', name: 'Media duties', short: 'Media', domain: 'Media' },
}

export const WORKSPACE_IDS = Object.keys(WORKSPACES) as WorkspaceId[]

/** What the workspace switcher can be set to: one workspace, or all of them at once. */
export type WorkspaceScope = WorkspaceId | 'all'

export const isScope = (v: string | undefined): v is WorkspaceScope => v === 'all' || (!!v && (WORKSPACE_IDS as string[]).includes(v))
