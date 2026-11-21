import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { Campaign, LinkPreview } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'
import { WhatsAppPreview } from './WhatsAppPreview'

/** Make or change a campaign: the words, the link, an optional picture, and how it will look in WhatsApp as you type. */
export function CampaignEditor({ open, campaign, onClose, onSaved }: { open: boolean; campaign: Campaign | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [url, setUrl] = useState('')
  const [image, setImage] = useState('')
  const [track, setTrack] = useState(true)
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(campaign?.name ?? '')
    setMessage(campaign?.message ?? 'Hi {name}, ')
    setUrl(campaign?.url ?? '')
    setImage(campaign?.imageUrl ?? '')
    setTrack(campaign?.trackClicks ?? true)
    setPreview(campaign?.preview ?? null)
  }, [open, campaign])

  // The preview follows the link: read the page's sharing tags a moment after the last key.
  useEffect(() => {
    const u = url.trim()
    if (!open || !/^https?:\/\/\S+\.\S+/i.test(u) || (campaign?.url === u && campaign.preview.title)) return
    let stale = false
    const id = setTimeout(() => {
      setLoading(true)
      agent
        .campaignPreview(u)
        .then((p) => !stale && setPreview(p))
        .catch((e) => !stale && setPreview({ error: e instanceof Error ? e.message : 'Couldn’t load the preview' }))
        .finally(() => !stale && setLoading(false))
    }, 600)
    return () => {
      stale = true
      clearTimeout(id)
    }
  }, [url, open, agent, campaign])

  async function save() {
    setSaving(true)
    try {
      const saved = await agent.campaignSave(campaign?.id ?? null, { name, message, url: url.trim(), image_url: image.trim(), track_clicks: track })
      await client.invalidateQueries({ queryKey: ['agent', 'campaigns'] })
      toast.success(campaign ? 'Saved' : 'Campaign made')
      onSaved(saved.id)
      onClose()
    } catch (e) {
      toast.error('Couldn’t save that', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const field = 'grid gap-1 text-xs font-medium text-muted-foreground'
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,38rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">{campaign ? 'Change the campaign' : 'New campaign'}</SheetTitle>
          <SheetDescription className="text-xs">One message for many contacts. Each person gets their own button that opens their WhatsApp chat with it written; you press send.</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-4">
          <label className={field}>
            Name (only you see it)
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wage report, November" maxLength={200} />
          </label>
          <label className={field}>
            Message
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} placeholder="Hi {name}, our new report is out." />
            <span className="font-normal">{'{name}'} becomes each person’s first name. The link goes at the end, or where you write {'{link}'}.</span>
          </label>
          <label className={field}>
            Link
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </label>
          <label className={field}>
            Picture (web address, optional)
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/picture.jpg" inputMode="url" />
            <span className="font-normal">WhatsApp can’t attach a picture from a link. A web address for the picture is sent as a link with its own preview; to send the file itself, attach it by hand when the chat opens.</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} className="mt-0.5 size-4 accent-[var(--foreground)]" />
            <span>
              Count who opens the link
              <span className="block text-xs text-muted-foreground">Each person gets their own short link that shows the same preview and then goes to your page. Needs this server to have a public https address.</span>
            </span>
          </label>
          <WhatsAppPreview message={message} url={url.trim()} imageUrl={image.trim()} preview={preview} loading={loading} />
        </div>
        <div className="flex gap-2 border-t px-5 py-3">
          <Button size="sm" onClick={() => void save()} disabled={saving || !name.trim() || !(message.trim() || url.trim() || image.trim())}>
            {saving && <Spinner size="xs" tone="current" decorative />} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
