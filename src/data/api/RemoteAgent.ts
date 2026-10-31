import type { AgentApi, AgentSettings, Channel, ChatReply, DecisionQuestion, DecisionResult, PromptPackage, PromptSettings, WhatsAppConnection } from '@/domain/ai/AgentApi'
import type { AiSelection, ModelInfo, ProviderId } from '@/domain/ai/types'
import { ApiHttp } from './ApiHttp'

/** The AI agent through the backend's `agent` service. Keys, prompt and channels are kept there. */
export class RemoteAgent implements AgentApi {
  constructor(private readonly http: ApiHttp) {}

  settings() {
    return this.http.get<AgentSettings>('/v1/agent/settings')
  }

  async putKey(provider: ProviderId, apiKey: string): Promise<ModelInfo[]> {
    return (await this.http.put<{ models: ModelInfo[] }>(`/v1/agent/providers/${provider}`, { apiKey })).models
  }

  async removeKey(provider: ProviderId) {
    await this.http.delete(`/v1/agent/providers/${provider}`)
  }

  async models(provider: ProviderId): Promise<ModelInfo[]> {
    return (await this.http.get<{ items: ModelInfo[] }>(`/v1/agent/providers/${provider}/models`)).items
  }

  async setSelection(s: AiSelection) {
    await this.http.put('/v1/agent/selection', { providerId: s.providerId, modelId: s.modelId, thinking: s.thinking })
  }

  async setDecision(enabled: boolean, modelId: string) {
    await this.http.put('/v1/agent/decision', { enabled, modelId })
  }

  async setPrompt(prompt: PromptSettings) {
    await this.http.put('/v1/agent/prompt', prompt)
  }

  async resetPrompt() {
    await this.http.delete('/v1/agent/prompt')
  }

  preview(question: string, prompt?: PromptSettings) {
    return this.http.post<PromptPackage>('/v1/agent/prompt/preview', { question, prompt })
  }

  chat(message: string, messages: unknown[]) {
    return this.http.post<ChatReply>('/v1/agent/chat', { message, messages })
  }

  decide(state: string, questions: Record<string, DecisionQuestion>, modelId?: string) {
    return this.http.post<DecisionResult>('/v1/agent/decide', { state, questions, modelId })
  }

  async channels(): Promise<Channel[]> {
    return (await this.http.get<{ items: Channel[] }>('/v1/agent/channels')).items
  }

  connectTelegram(botToken: string) {
    return this.http.post<Channel>('/v1/agent/channels/telegram', { botToken })
  }

  connectWhatsApp(c: WhatsAppConnection) {
    return this.http.post<Channel>('/v1/agent/channels/whatsapp', c)
  }

  newPairingCode(channelId: string) {
    return this.http.post<Channel>(`/v1/agent/channels/${channelId}/pairing`)
  }

  async unpair(channelId: string, chatId: string) {
    return this.http.request<Channel>('DELETE', `/v1/agent/channels/${channelId}/pairing/${encodeURIComponent(chatId)}`)
  }

  setAllowed(channelId: string, allowed: string[]) {
    return this.http.put<Channel>(`/v1/agent/channels/${channelId}/allowed`, { allowed })
  }

  async sendTest(channelId: string) {
    await this.http.post(`/v1/agent/channels/${channelId}/test`)
  }

  async removeChannel(channelId: string) {
    await this.http.delete(`/v1/agent/channels/${channelId}`)
  }
}
