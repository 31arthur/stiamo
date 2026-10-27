import { isOngoing } from '@/domain/clients/Client'
import type { EntityRef } from '@/domain/shared/types'
import { Field, NativeSelect } from '@/presentation/components/form'
import { useEntities } from '@/presentation/data/hooks'

const toValue = (r?: EntityRef) => (r && (r.kind === 'client' || r.kind === 'project') ? `${r.kind}:${r.id}` : '')

/** Ties a meeting or task to an FSA client or one of their projects. */
export function ClientProjectField({ id, value, onChange }: { id: string; value: EntityRef | undefined; onChange: (ref: EntityRef | undefined, clientName?: string) => void }) {
  const { data: clients } = useEntities('client')
  const { data: projects } = useEntities('project')
  const byClient = new Map(clients.map((c) => [c.id, c]))
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name))
  const current = value && (value.kind === 'client' || value.kind === 'project') ? value : undefined

  function pick(raw: string) {
    if (!raw) return onChange(undefined)
    const [kind, ...rest] = raw.split(':')
    const ref = { kind, id: rest.join(':') } as EntityRef
    const client = ref.kind === 'client' ? byClient.get(ref.id) : byClient.get(projects.find((p) => p.id === ref.id)?.clientId ?? '')
    onChange(ref, client?.name)
  }

  return (
    <Field label="Client / project" htmlFor={id} hint={clients.length ? undefined : 'Add a client first from Clients & projects'}>
      <NativeSelect id={id} value={toValue(current)} onChange={(e) => pick(e.target.value)}>
        <option value="">None</option>
        {sorted.map((c) => {
          const theirs = projects.filter((p) => p.clientId === c.id).sort((a, b) => Number(isOngoing(b)) - Number(isOngoing(a)) || a.title.localeCompare(b.title))
          return (
            <optgroup key={c.id} label={c.name}>
              <option value={`client:${c.id}`}>{c.name} — general</option>
              {theirs.map((p) => (
                <option key={p.id} value={`project:${p.id}`}>
                  {p.title}
                </option>
              ))}
            </optgroup>
          )
        })}
      </NativeSelect>
    </Field>
  )
}
