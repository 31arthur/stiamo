import type { LinkPreview } from '@/domain/ai/AgentApi'

/** The first name of whoever is shown in the sample, so {name} reads as it will. */
export function previewText(message: string, url: string, name: string) {
  const text = message.replace(/\{name\}/g, name.split(' ')[0] ?? '').trim()
  if (text.includes('{link}')) return text.replace(/\{link\}/g, url).trim()
  return url ? `${text}\n${url}`.trim() : text
}

/**
 * How the message will look in WhatsApp: a green bubble with the link's own card (picture, site, title, description) above the words. The card is what WhatsApp
 * builds from the page's sharing tags once the message is sent, so what shows here is what the person will see.
 */
export function WhatsAppPreview({ message, url, imageUrl, preview, name = 'Ali Hassan', loading }: { message: string; url: string; imageUrl?: string; preview: LinkPreview | null; name?: string; loading?: boolean }) {
  const text = previewText(message, url || imageUrl || '', name)
  const card = preview && !preview.error && (preview.title || preview.image || preview.description) ? preview : null
  const picture = card?.image || (!url && imageUrl ? imageUrl : '')
  return (
    <div className="rounded-2xl bg-[#e5ddd5] p-4 dark:bg-[#0b141a]" aria-label="How it will look in WhatsApp">
      <div className="ml-auto w-full max-w-[22rem] rounded-xl rounded-tr-sm bg-[#d9fdd3] p-1.5 text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        {(card || picture || loading) && (
          <div className="overflow-hidden rounded-lg bg-black/5 dark:bg-black/20">
            {picture ? <img src={picture} alt="" className="max-h-44 w-full object-cover" referrerPolicy="no-referrer" /> : loading ? <div className="h-24 animate-pulse bg-black/10" /> : null}
            {card && (
              <div className="grid gap-0.5 px-2.5 py-2">
                {card.title && <p className="line-clamp-2 text-[13px] font-semibold">{card.title}</p>}
                {card.description && <p className="line-clamp-3 text-xs opacity-80">{card.description}</p>}
                <p className="text-[11px] opacity-60">{card.host ?? card.site}</p>
              </div>
            )}
          </div>
        )}
        {preview?.error && <p className="px-2 py-1 text-[11px] text-destructive">{preview.error}</p>}
        <p className="px-1.5 pt-1.5 pb-0.5 text-[13.5px] break-words whitespace-pre-wrap">
          {text || <span className="opacity-50">Your message</span>}
        </p>
        <p className="px-1.5 pb-0.5 text-right text-[10px] opacity-60">10:30 ✓✓</p>
      </div>
      <p className="mt-2 text-center text-[11px] text-black/50 dark:text-white/50">WhatsApp builds the card itself when the message is sent. Photos can’t be attached from a link: send the picture’s web address, or attach it yourself.</p>
    </div>
  )
}
