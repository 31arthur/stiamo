import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Channel } from '@/domain/ai/AgentApi'
import { PROVIDER_IDS, PROVIDERS } from '@/domain/ai/types'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { PageHeader } from '@/presentation/components/layout'
import { CREDENTIAL_TYPES, CredentialModal } from './studio/CredentialModal'
import type { CredentialKind } from './studio/CredentialModal'
import { useAgentSettings, useChannels } from './useAgent'

interface Row {
  key: string
  kind: CredentialKind
  name: string
  detail: string
  ok: boolean
  channel?: Channel
}

/** Everything agents and workflows connect with, in one list, the way n8n keeps credentials: Telegram bots, WhatsApp numbers and AI provider keys. */
export function CredentialsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { channels, loading } = useChannels()
  const { settings } = useAgentSettings()
  const [modal, setModal] = useState<{ kind?: CredentialKind; channel?: Channel } | null>(null)

  const rows: Row[] = [
    ...channels.map((c): Row => ({
      key: c.id,
      kind: c.kind,
      name: c.kind === 'telegram' ? `@${c.username ?? 'bot'}` : (c.account ?? c.from ?? 'WhatsApp'),
      detail: c.kind === 'telegram' ? `${c.workspace && c.workspace in WORKSPACES ? `${WORKSPACES[c.workspace as WorkspaceId].short} only` : 'All workspaces'} · ${c.paired?.length ? `${c.paired.length} chat${c.paired.length === 1 ? '' : 's'} linked` : 'no chat linked yet'}` : `Sends from ${c.from ?? '—'}`,
      ok: c.kind === 'telegram' ? !!c.paired?.length : true,
      channel: c,
    })),
    ...PROVIDER_IDS.filter((id) => settings?.providers[id]?.connected).map((id): Row => ({ key: `provider:${id}`, kind: 'provider', name: PROVIDERS[id].label, detail: `Key ending …${settings?.providers[id]?.last4 ?? ''}`, ok: true })),
  ]

  return (
    <>
      {embedded ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Accounts</h2>
            <p className="text-xs text-muted-foreground">Telegram bots, WhatsApp numbers and AI keys. A node or an agent asks for one by name; each is kept once, encrypted on your server.</p>
          </div>
          <Button size="sm" onClick={() => setModal({})}>
            <Plus /> Add account
          </Button>
        </div>
      ) : (
        <PageHeader
          eyebrow="Agents"
          title="Credentials"
          description="The accounts your agents and workflows connect with. A node asks for one by name, so a key or token is kept once, encrypted on your server, and never sent back to the browser."
          actions={
            <Button onClick={() => setModal({})}>
              <Plus /> Create credential
            </Button>
          }
        />
      )}
      {loading ? (
        <Spinner label="Loading" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
          <p className="font-display text-2xl italic">No credentials yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Connect a Telegram bot to send messages from a workflow, or an AI provider key so an AI agent has a model to think with.</p>
          <Button className="mt-4" onClick={() => setModal({})}>
            <Plus /> Create credential
          </Button>
        </div>
      ) : (
        <ul className="grid divide-y rounded-2xl border bg-card/70">
          {rows.map((r) => {
            const t = CREDENTIAL_TYPES.find((x) => x.kind === r.kind)!
            return (
              <li key={r.key}>
                <button type="button" onClick={() => setModal({ kind: r.kind, channel: r.channel })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <t.icon className={`size-4.5 ${t.tone}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.label} · {r.detail}
                    </span>
                  </span>
                  <span className={r.ok ? 'rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success' : 'rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning'}>{r.ok ? 'Connected' : 'Link a chat'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <CredentialModal open={modal !== null} onOpenChange={(v) => !v && setModal(null)} kind={modal?.kind} channel={modal?.channel} />
    </>
  )
}
