import type { LiveEvent, MailAccount, MailAccountChanges, MailApi, MailAttachment, MailFolder, MailMessage, MailPage, NewMailAccount } from '@/domain/mail/Mail'
import { ApiHttp } from './ApiHttp'
import { readEvents } from './sse'

const base = (id: string) => `/v1/mail/accounts/${encodeURIComponent(id)}`
const RETRY_MS = [2000, 5000, 15_000, 30_000]

/** Mailboxes through the backend's `mail` service. Mail is read from the IMAP server each time; nothing is kept here. */
export class RemoteMail implements MailApi {
  constructor(private readonly http: ApiHttp) {}

  accounts() {
    return this.http.get<MailAccount[]>('/v1/mail/accounts')
  }
  connect(account: NewMailAccount) {
    return this.http.post<MailAccount>('/v1/mail/accounts', account)
  }
  edit(id: string, changes: MailAccountChanges) {
    return this.http.patch<MailAccount>(base(id), changes)
  }
  disconnect(id: string) {
    return this.http.delete(base(id))
  }
  test(id: string) {
    return this.http.post<void>(`${base(id)}/test`)
  }
  folders(accountId: string) {
    return this.http.get<MailFolder[]>(`${base(accountId)}/folders`)
  }
  page(accountId: string, folder: string, opts: { before?: number; q?: string }) {
    return this.http.get<MailPage>(`${base(accountId)}/messages`, { folder, before: opts.before, q: opts.q })
  }
  message(accountId: string, folder: string, uid: number) {
    return this.http.get<MailMessage>(`${base(accountId)}/messages/${uid}`, { folder })
  }
  async mark(accountId: string, folder: string, uid: number, flags: { seen?: boolean; flagged?: boolean }) {
    await this.http.request('PATCH', `${base(accountId)}/messages/${uid}`, { json: flags, query: { folder } })
  }
  download(accountId: string, folder: string, uid: number, a: MailAttachment) {
    return this.http.request<Blob>('GET', `${base(accountId)}/messages/${uid}/attachments/${a.index}`, { query: { folder }, as: 'blob' })
  }

  watch(accountId: string, folder: string, onEvent: (e: LiveEvent) => void, signal: AbortSignal) {
    void (async () => {
      let attempt = 0
      while (!signal.aborted) {
        onEvent({ type: 'state', state: 'connecting' })
        try {
          const token = await this.http.accessToken()
          const url = `${this.http.url(`${base(accountId)}/events`)}?folder=${encodeURIComponent(folder)}`
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal })
          if (!res.ok || !res.body) throw new Error(String(res.status))
          attempt = 0
          await readEvents(res.body, (name, data) => {
            if (name === 'state' || name === 'changed') onEvent(JSON.parse(data) as LiveEvent)
          })
        } catch {
          if (signal.aborted) return
        }
        if (signal.aborted) return
        onEvent({ type: 'state', state: 'down' })
        await new Promise((r) => setTimeout(r, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]))
      }
    })()
  }
}
