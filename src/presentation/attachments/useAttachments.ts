import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Attachment } from '@/domain/attachments/Attachment'

/** Drawing scenes are internal to the plan page; their PNG previews are what people see. */
const SCENE_MIME = 'application/vnd.excalidraw+json'
import type { EntityRef } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { useEntities } from '@/presentation/data/hooks'

export function useAttachments(owner: EntityRef | undefined): Attachment[] {
  const { data } = useEntities('attachment')
  return useMemo(
    () => (owner ? data.filter((a) => a.owner.kind === owner.kind && a.owner.id === owner.id && a.mime !== SCENE_MIME).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [data, owner],
  )
}

/** How many files each record has, for paperclip badges in lists. */
export function useAttachmentCounts(): Map<string, number> {
  const { data } = useEntities('attachment')
  return useMemo(() => {
    const m = new Map<string, number>()
    for (const a of data) if (a.mime !== SCENE_MIME) m.set(`${a.owner.kind}:${a.owner.id}`, (m.get(`${a.owner.kind}:${a.owner.id}`) ?? 0) + 1)
    return m
  }, [data])
}

/** A displayable URL for an attachment (resolved once and cached). */
export function useFileUrl(attachment: Attachment | undefined) {
  const { attachments } = useServices()
  return useQuery({
    queryKey: ['file-url', attachment?.id],
    queryFn: () => attachments.url(attachment!),
    enabled: !!attachment,
    // Signed links expire after an hour; ask again well before that.
    staleTime: 40 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
