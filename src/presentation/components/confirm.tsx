import { useState } from 'react'
import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** A destructive action that asks once, in place. */
export function ConfirmDelete({ what, onConfirm, children }: { what: string; onConfirm: () => Promise<unknown> | void; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" />}>
        {children ?? (
          <>
            <Trash2 /> Delete
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm">
          Delete <span className="font-medium">{what}</span>? This can’t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Keep
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                setOpen(false)
              } finally {
                setBusy(false)
              }
            }}
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
