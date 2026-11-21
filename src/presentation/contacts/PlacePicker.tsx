import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { Place } from '@/domain/contacts/Contacts'
import { useServices } from '@/presentation/app/services'

/**
 * Type a town, region or country and pick from what matches (any place in the world, from a free place search): "Mahbubnagar, Telangana", "Ghardaia, Algeria".
 * Picking fills the place and the time zone it is in. What is typed without picking is kept as typed.
 */
export function PlacePicker({ value, onChange, onPick }: { value: string; onChange: (text: string) => void; onPick: (place: Place) => void }) {
  const { contacts } = useServices()
  const [found, setFound] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const typed = useRef(false)
  useEffect(() => {
    if (!typed.current || value.trim().length < 3) return setFound([])
    let stale = false
    const id = setTimeout(() => {
      setBusy(true)
      contacts
        .places(value.trim())
        .then((p) => !stale && (setFound(p), setOpen(true)))
        .catch(() => !stale && setFound([]))
        .finally(() => !stale && setBusy(false))
    }, 350)
    return () => {
      stale = true
      clearTimeout(id)
    }
  }, [value, contacts])

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => ((typed.current = true), onChange(e.target.value))}
        onFocus={() => found.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing a town: Mahbubnagar, Ghardaia, Doha…"
        role="combobox"
        aria-expanded={open && found.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {busy && <Spinner size="xs" decorative className="absolute top-1/2 right-3 -translate-y-1/2" />}
      {open && found.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-md">
          {found.map((p) => (
            <li key={`${p.label}|${p.timezone}`} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  typed.current = false
                  onPick(p)
                  setFound([])
                  setOpen(false)
                }}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate">{p.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.timezone}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {typed.current && !busy && value.trim().length >= 3 && found.length === 0 && <p className="mt-1 text-[11px] font-normal text-muted-foreground">No match. Try the nearest bigger town, or keep what you typed.</p>}
    </div>
  )
}
