import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { Contact } from '@/domain/contacts/Contacts'
import { WORKSPACES } from '@/domain/shared/workspace'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { useContactList } from '@/presentation/contacts/useContacts'

/** Choose the contacts for a campaign: search, narrow by a tag, tick people, or take everyone shown. */
export function ContactPicker({ open, onClose, onAdd, busy }: { open: boolean; onClose: () => void; onAdd: (contacts: Contact[]) => void; busy: boolean }) {
  const { scope } = useWorkspaceFilter()
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [picked, setPicked] = useState<Map<string, Contact>>(new Map())
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300)
    return () => clearTimeout(id)
  }, [typed])
  useEffect(() => {
    if (open) setPicked(new Map())
  }, [open])
  const { items, total, loading } = useContactList(scope, q, 500, open)
  const tags = useMemo(() => [...new Set(items.flatMap((c) => c.tags ?? []))].sort(), [items])
  const shown = useMemo(() => items.filter((c) => !tag || (c.tags ?? []).includes(tag)), [items, tag])
  const toggle = (c: Contact) =>
    setPicked((m) => {
      const n = new Map(m)
      if (n.has(c.id)) n.delete(c.id)
      else n.set(c.id, c)
      return n
    })
  const allShown = shown.length > 0 && shown.every((c) => picked.has(c.id))

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,34rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">Add contacts</SheetTitle>
          <SheetDescription className="text-xs">From {scope === 'all' ? 'all workspaces' : WORKSPACES[scope].name}. Someone already in the campaign stays as they are. People without a number are added too, but have no WhatsApp button.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 border-b px-5 py-3">
          <label className="relative block">
            <span className="sr-only">Search contacts</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search by name, organisation, email or number" className="pl-9" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="h-8 rounded-md border bg-transparent px-2 text-xs" aria-label="Only people with this tag">
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allShown}
                onChange={() => setPicked((m) => (allShown ? new Map([...m].filter(([id]) => !shown.some((c) => c.id === id))) : new Map([...m, ...shown.map((c): [string, Contact] => [c.id, c])])))}
                className="size-4 accent-[var(--foreground)]"
              />
              Everyone shown ({shown.length}
              {total > items.length ? ` of ${total}; narrow the search for the rest` : ''})
            </label>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <Spinner label="Loading contacts" />
          ) : shown.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No one matches.</p>
          ) : (
            <ul className="divide-y">
              {shown.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-muted/50">
                    <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c)} className="size-4 accent-[var(--foreground)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[c.organisation, c.phones[0]?.value ?? 'no number', ...(c.tags ?? []).slice(0, 3)].filter(Boolean).join(' · ')}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2 border-t px-5 py-3">
          <Button size="sm" disabled={busy || picked.size === 0} onClick={() => onAdd([...picked.values()])}>
            {busy && <Spinner size="xs" tone="current" decorative />} Add {picked.size || ''} {picked.size === 1 ? 'person' : 'people'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
