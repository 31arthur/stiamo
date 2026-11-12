import type {
  AiJob,
  Chapter,
  Character,
  CharacterView,
  DraftCard,
  DraftResult,
  EditorSettings,
  Evidence,
  Part,
  Profile,
  StoriesApi,
  Story,
  StoryMomentum,
  Timeline,
} from '@/domain/stories/Stories'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { ApiHttp } from './ApiHttp'

const enc = encodeURIComponent

/** Stories, the cast and what is known about people: records in the practice service, drafts and the editor in the agent service. */
export class RemoteStories implements StoriesApi {
  constructor(private readonly http: ApiHttp) {}

  private async all<T>(path: string): Promise<T[]> {
    const out: T[] = []
    let after: string | undefined
    for (let i = 0; i < 20; i++) {
      const page = await this.http.get<{ items: T[]; nextCursor: string | null }>(path, { limit: 1000, after })
      out.push(...page.items)
      if (!page.nextCursor) break
      after = page.nextCursor
    }
    return out
  }

  stories() {
    return this.all<Story>('/v1/stories')
  }

  saveStory(story: Story) {
    const { createdAt: _c, updatedAt: _u, ...draft } = story as Story & { userId?: string }
    return this.http.put<Story>(`/v1/stories/${enc(story.id)}`, draft)
  }

  async removeStory(id: string) {
    await this.http.delete(`/v1/stories/${enc(id)}`)
  }

  timeline(id: string) {
    return this.http.get<Timeline>(`/v1/stories/${enc(id)}/timeline`)
  }

  writeChapter(storyId: string, body: { prose: string; title?: string; date?: string; source?: string }) {
    return this.http.post<{ chapter: Chapter }>(`/v1/stories/${enc(storyId)}/chapters/write`, body)
  }

  draftChapter(body: { prose: string; story?: string; title?: string; date?: string }) {
    return this.http.post<DraftResult>('/v1/agent/stories/chapters/draft', body)
  }

  arcTemplates() {
    return this.all<{ id: string; name: string; workspace: WorkspaceId; checkpoints: string[]; ending: string }>('/v1/arc-templates')
  }

  async saveArcTemplate(t: { id: string; name: string; workspace: WorkspaceId; checkpoints: string[]; ending: string }) {
    await this.http.put(`/v1/arc-templates/${enc(t.id)}`, t)
  }

  characters() {
    return this.all<Character>('/v1/characters')
  }

  character(id: string) {
    return this.http.get<CharacterView>(`/v1/characters/${enc(id)}/view`)
  }

  saveCharacter(c: Character) {
    const { profile: _p, ...draft } = c
    return this.http.put<Character>(`/v1/characters/${enc(c.id)}`, draft)
  }

  async removeCharacter(id: string) {
    await this.http.delete(`/v1/characters/${enc(id)}`)
  }

  joinCast(body: { name: string; phones?: string[]; organisation?: string; title?: string; storyId?: string; part?: string; home?: WorkspaceId; characterId?: string }) {
    return this.http.post<{ character: Character; part: Part | null; matched: string }>('/v1/characters/join', body)
  }

  mergeCharacter(id: string, into: string) {
    return this.http.post<Character>(`/v1/characters/${enc(id)}/merge`, { into })
  }

  parts() {
    return this.all<Part>('/v1/parts')
  }

  saveCharacterPart(p: Part) {
    return this.http.put<Part>(`/v1/parts/${enc(p.id)}`, p)
  }

  async removePart(id: string) {
    await this.http.delete(`/v1/parts/${enc(id)}`)
  }

  evidence() {
    return this.all<Evidence>('/v1/evidence')
  }

  profile(characterId: string) {
    return this.http.get<Profile>(`/v1/characters/${enc(characterId)}/profile`)
  }

  peopleFromText(text: string, story?: string) {
    return this.http.post<{ cards: DraftCard[]; none?: boolean; error?: string }>('/v1/agent/cast/from-text', { text, story })
  }

  editor() {
    return this.http.get<{ settings: EditorSettings; stories: StoryMomentum[] }>('/v1/agent/editor')
  }

  setEditorSettings(s: EditorSettings) {
    return this.http.put<EditorSettings>('/v1/agent/editor/settings', s)
  }

  runEditor(workspace?: WorkspaceId) {
    return this.http.post<{ sent: unknown[] }>('/v1/agent/editor/run', { workspace })
  }

  codeScenes() {
    return this.http.post<{ coded: number; evidence: number; waiting?: number; reason?: string }>('/v1/agent/cast/code', {})
  }

  async jobs() {
    return (await this.http.get<{ items: AiJob[] }>('/v1/agent/jobs')).items
  }

  async setJobModel(name: string, choice: { provider: string; model: string; thinking?: string } | null) {
    return (await this.http.put<{ items: AiJob[] }>(`/v1/agent/jobs/${enc(name)}/model`, choice ? { provider: choice.provider, model: choice.model, thinking: choice.thinking ?? 'off' } : {})).items
  }
}
