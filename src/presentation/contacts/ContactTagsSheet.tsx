import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { Contact, ContactProfile } from '@/domain/contacts/Contacts'
import { toast } from '@/presentation/notifications/toast'
import { useContactUpdate } from './useContacts'

const SECTORS = ['Trade union', 'Government', 'Funder', 'Media', 'Client', 'Legal', 'Technology', 'Civil society', 'International body', 'Other']
const RELATIONSHIPS = ['Partner', 'Official', 'Prospect', 'Peer', 'Client', 'Funder', 'Journalist']
const ZONES = ['Asia/Kolkata', 'Asia/Qatar', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Europe/London', 'Europe/Geneva', 'America/New_York', 'America/Sao_Paulo', 'Australia/Sydney']

/** What you know about one contact: tags, sector, how close to keep, where they are. Kept in Stiamo only. Every new contact gets a get-to-know plan that reads this to write each message. */
export function ContactTagsSheet({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const update = useContactUpdate()
  const [tags, setTags] = useState('')
  const [profile, setProfile] = useState<ContactProfile>({})
  const [zone, setZone] = useState('')
  const [place, setPlace] = useState('')
  const [excluded, setExcluded] = useState(false)
  useEffect(() => {
    if (!contact) return
    setTags((contact.tags ?? []).join(', '))
    setProfile(contact.profile ?? {})
    setZone(contact.timezone ?? '')
    setPlace(contact.location ?? '')
    setExcluded(!!contact.rapportExcluded)
  }, [contact])
  const set = (patch: Partial<ContactProfile>) => setProfile((p) => ({ ...p, ...patch }))

  async function save() {
    if (!contact) return
    try {
      const saved = await update.mutateAsync({
        id: contact.id,
        changes: { tags: tags.split(',').map((t) => t.trim()).filter(Boolean), profile: Object.fromEntries(Object.entries(profile).filter(([, v]) => v)) as ContactProfile, timezone: zone, rapport_excluded: excluded, ...(place.trim() !== (contact.location ?? '') ? { location: place.trim() } : {}) },
      })
      if (saved.googleNote) toast.warning('Saved', { description: saved.googleNote })
      else toast.success('Saved', { description: saved.googleSaved ? 'Their place is in Google too.' : 'Kept in Stiamo.' })
      onClose()
    } catch (e) {
      toast.error('Couldn’t save that', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const field = 'grid gap-1 text-xs font-medium text-muted-foreground'
  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,34rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">{contact?.name}</SheetTitle>
          <SheetDescription className="text-xs">Tags and notes for the get-to-know plan, kept in Stiamo. Where they are is also saved in their address in Google.</SheetDescription>
        </SheetHeader>
        {contact && (
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-4">
            <label className={field}>
              Tags (comma separated)
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="union, migration, Gulf" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                Sector
                <Input list="contact-sectors" value={profile.sector ?? ''} onChange={(e) => set({ sector: e.target.value })} />
                <datalist id="contact-sectors">
                  {SECTORS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className={field}>
                Relationship
                <Input list="contact-relationships" value={profile.relationship ?? ''} onChange={(e) => set({ relationship: e.target.value })} />
                <datalist id="contact-relationships">
                  {RELATIONSHIPS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className={field}>
                How close to keep in touch
                <select value={profile.tier ?? ''} onChange={(e) => set({ tier: (e.target.value || undefined) as ContactProfile['tier'] })} className="h-9 rounded-md border bg-transparent px-2 text-sm text-foreground">
                  <option value="">Usual (B)</option>
                  <option value="A">Key (A): closest</option>
                  <option value="B">Usual (B)</option>
                  <option value="C">Light (C)</option>
                </select>
              </label>
              <label className={field}>
                Where they are (city, country)
                <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Doha, Qatar" />
                <span className="font-normal">Their messages go in their working hours. Saved in Google too.</span>
              </label>
              <label className={field}>
                Time zone (if it is not obvious)
                <Input list="contact-zones" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Worked out from where they are, or their number" />
                <datalist id="contact-zones">
                  {ZONES.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </label>
              <label className={field}>
                Language for messages
                <Input value={profile.language ?? ''} onChange={(e) => set({ language: e.target.value })} placeholder="English" />
              </label>
              <label className={field}>
                How you met
                <Input value={profile.how_met ?? ''} onChange={(e) => set({ how_met: e.target.value })} />
              </label>
            </div>
            <label className={field}>
              What they care about
              <Input value={profile.interests ?? ''} onChange={(e) => set({ interests: e.target.value })} />
            </label>
            <label className={field}>
              What you want from the relationship
              <Input value={profile.goal ?? ''} onChange={(e) => set({ goal: e.target.value })} />
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} className="mt-0.5 size-4 accent-[var(--foreground)]" />
              <span>
                No get-to-know plan for this contact
                <span className="block text-xs text-muted-foreground">Every new contact gets one on its own. Untick to bring it back; Chittu can also attach a plan to a contact you already know.</span>
              </span>
            </label>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => void save()} disabled={update.isPending}>
                {update.isPending && <Spinner size="xs" tone="current" decorative />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
