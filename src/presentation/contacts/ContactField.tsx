import { useEffect, useMemo, useState } from 'react'
import { Mail, Phone, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { contactLine, emailOf, phoneOf } from '@/domain/contacts/dial'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { useContactList, useContactsAvailable, useContactsStatus } from './useContacts'

interface Option {
  key: string
  line: string
  name: string
  detail: string
  kind: 'phone' | 'email' | 'name'
  /** The contact it comes from. */
  contactId: string
}

/**
 * Who to reach. Type anything (a name, a number, an address), or start a name and pick from the workspace's Google contacts: the name and
 * the number are filled in together, and the number is then a tap away wherever the item is shown. Without linked contacts it is a plain field.
 */
export function ContactField({ id, value, onChange, workspace, placeholder }: { id?: string; value?: string; /** `contactId` is set when a contact was picked, and cleared as soon as the line is typed over. */ onChange: (value: string | undefined, contactId?: string) => void; workspace: WorkspaceId; placeholder?: string }) {
  const available = useContactsAvailable()
  const status = useContactsStatus()
  const linked = available && (status.data?.accounts ?? []).some((a) => a.workspace === workspace)
  const text = value ?? ''
  const [focus, setFocus] = useState(false)
  const [q, setQ] = useState('')
  // Only a name being typed is looked up: once there is a number in it, a contact was picked or the person knows who they mean.
  const typing = focus && linked && !phoneOf(text) && !emailOf(text)
  useEffect(() => {
    const t = setTimeout(() => setQ(typing ? text.trim() : ''), 250)
    return () => clearTimeout(t)
  }, [text, typing])
  const { items } = useContactList(workspace, q, 6, typing && q.length >= 2)

  const options = useMemo<Option[]>(
    () =>
      items.flatMap((c): Option[] => {
        const who = [c.title, c.organisation].filter(Boolean).join(' · ')
        const phones: Option[] = c.phones.map((p) => ({ key: `${c.id}:${p.value}`, line: contactLine(c.name, p.value), name: c.name, detail: `${p.value}${p.label ? ` · ${p.label}` : ''}`, kind: 'phone', contactId: c.id }))
        if (phones.length) return phones
        const mail = c.emails[0]
        return mail ? [{ key: `${c.id}:${mail.value}`, line: contactLine(c.name, mail.value), name: c.name, detail: mail.value, kind: 'email', contactId: c.id }] : [{ key: c.id, line: c.name, name: c.name, detail: who, kind: 'name', contactId: c.id }]
      }),
    [items],
  )
  const open = typing && q.length >= 2 && options.length > 0

  return (
    <div className="relative">
      <Input id={id} value={text} onChange={(e) => onChange(e.target.value || undefined, undefined)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholder={placeholder} autoComplete="off" role={linked ? 'combobox' : undefined} aria-expanded={linked ? open : undefined} aria-autocomplete={linked ? 'list' : undefined} />
      {open && (
        <ul role="listbox" aria-label="Contacts" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
          {options.map((o) => {
            const Icon = o.kind === 'phone' ? Phone : o.kind === 'email' ? Mail : User
            return (
              <li key={o.key} role="option" aria-selected={false}>
                <button
                  type="button"
                  // The field must not lose focus (and close this) before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.line, o.contactId)
                    setFocus(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                  <span className="max-w-[55%] truncate text-xs text-muted-foreground">{o.detail}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
