import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, PROJECT_STATUS_LABELS } from '@/domain/clients/Client'
import type { Client, ClientKind, ClientStatus, Project, ProjectStatus } from '@/domain/clients/Client'
import { DateInput, Field, NativeSelect, Segmented } from '@/presentation/components/form'
import { useEntities, useSave } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

export type ClientDraft = Omit<Client, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
export type ProjectDraft = Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newClient = (over: Partial<ClientDraft> = {}): ClientDraft => ({ kind: 'company', name: '', status: 'active', notes: '', ...over })
export const newProject = (over: Partial<ProjectDraft> = {}): ProjectDraft => ({ title: '', clientId: '', status: 'active', description: '', ...over })

export function ClientForm({ initial, onDone }: { initial: Client | ClientDraft; onDone: (saved?: Client) => void }) {
  const [c, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const save = useSave('client', editing ? 'Client updated' : 'Client added')

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Add client'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(c))}>
      <Segmented<ClientKind>
        label="Kind"
        value={c.kind}
        onChange={(kind) => patch({ kind })}
        options={(Object.keys(CLIENT_KIND_LABELS) as ClientKind[]).map((k) => ({ value: k, label: CLIENT_KIND_LABELS[k] }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.kind === 'company' ? 'Company' : 'Name'} htmlFor="cl-name">
          <Input id="cl-name" autoFocus value={c.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        {c.kind === 'company' && (
          <Field label="Contact person" htmlFor="cl-contact">
            <Input id="cl-contact" value={c.contactName ?? ''} onChange={(e) => patch({ contactName: e.target.value || undefined })} />
          </Field>
        )}
        <Field label="Phone" htmlFor="cl-phone">
          <Input id="cl-phone" type="tel" inputMode="tel" value={c.phone ?? ''} onChange={(e) => patch({ phone: e.target.value || undefined })} />
        </Field>
        <Field label="Email" htmlFor="cl-email">
          <Input id="cl-email" type="email" inputMode="email" value={c.email ?? ''} onChange={(e) => patch({ email: e.target.value || undefined })} />
        </Field>
        <Field label="Website" htmlFor="cl-web">
          <Input id="cl-web" inputMode="url" value={c.website ?? ''} onChange={(e) => patch({ website: e.target.value || undefined })} placeholder="https://" />
        </Field>
        <Field label="Status">
          <Segmented<ClientStatus> size="sm" label="Status" value={c.status} onChange={(status) => patch({ status })} options={(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((s) => ({ value: s, label: CLIENT_STATUS_LABELS[s] }))} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="cl-notes" hint="How they like to work, billing, who referred them…">
        <Textarea id="cl-notes" value={c.notes} onChange={(e) => patch({ notes: e.target.value })} className="min-h-20" />
      </Field>
    </FormShell>
  )
}

export function ProjectForm({ initial, onDone }: { initial: Project | ProjectDraft; onDone: (saved?: Project) => void }) {
  const [p, patch] = usePatch(initial)
  const { data: clients } = useEntities('client')
  const editing = 'createdAt' in initial
  const save = useSave('project', editing ? 'Project updated' : 'Project created')

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Create project'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(p))}>
      <Field label="Project" htmlFor="pr-title">
        <Input id="pr-title" autoFocus value={p.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Customer portal rebuild" />
      </Field>
      <Field label="Client" htmlFor="pr-client">
        <NativeSelect id="pr-client" value={p.clientId} onChange={(e) => patch({ clientId: e.target.value })}>
          <option value="">Choose a client…</option>
          {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Status">
        <Segmented<ProjectStatus> size="sm" label="Status" value={p.status} onChange={(status) => patch({ status })} options={(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="pr-start">
          <DateInput id="pr-start" value={p.startDate} onChange={(startDate) => patch({ startDate })} />
        </Field>
        <Field label="Due" htmlFor="pr-due">
          <DateInput id="pr-due" value={p.dueDate} onChange={(dueDate) => patch({ dueDate })} />
        </Field>
      </div>
      <Field label="Description" htmlFor="pr-desc" hint="Scope, deliverables, what “done” means">
        <Textarea id="pr-desc" value={p.description} onChange={(e) => patch({ description: e.target.value })} className="min-h-20" />
      </Field>
    </FormShell>
  )
}
