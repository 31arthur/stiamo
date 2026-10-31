import type { DriveApi, DriveMatch, DrivePage, DriveStatus } from '@/domain/drive/Drive'
import { ApiHttp } from './ApiHttp'

/** Drive search through the backend's `drive` service. */
export class RemoteDrive implements DriveApi {
  constructor(private readonly http: ApiHttp) {}

  async status(): Promise<DriveStatus> {
    return this.http.get<DriveStatus>('/v1/drive/status')
  }

  search(query: string, pageToken?: string): Promise<DrivePage> {
    return this.http.get<DrivePage>('/v1/drive/search', { q: query, pageToken, limit: 20 })
  }

  content(fileId: string): Promise<Blob> {
    return this.http.blob(`/v1/drive/files/${encodeURIComponent(fileId)}/content`)
  }

  async suggest(terms: string[]): Promise<DriveMatch[]> {
    if (terms.length === 0) return []
    return (await this.http.post<{ items: DriveMatch[] }>('/v1/drive/suggest', { terms })).items
  }
}
