import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

/**
 * "Saving…" while a write is in flight, then "Saved" for a moment. Pages that save as you type use
 * it so you never wonder whether your work is safe.
 */
export function SaveStatus({ pending }: { pending: boolean }) {
  const [saved, setSaved] = useState(false)
  const was = useRef(false)

  useEffect(() => {
    if (was.current && !pending) {
      setSaved(true)
      const id = setTimeout(() => setSaved(false), 2500)
      was.current = false
      return () => clearTimeout(id)
    }
    was.current = pending
  }, [pending])

  return (
    <div className="flex h-6 min-w-16 items-center justify-end text-xs text-muted-foreground" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1">
            <Spinner size="xs" tone="current" decorative /> Saving…
          </motion.span>
        ) : saved ? (
          <motion.span key="saved" initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-success">
            <Check className="size-3" /> Saved
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
