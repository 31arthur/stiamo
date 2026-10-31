import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { HelpCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { spring } from '@/presentation/motion/presets'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  /** A number or short phrase shown large, so what is about to happen is hard to miss: "19 emails". */
  highlight?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` is for what moves or removes something. */
  tone?: 'danger' | 'default'
}

/** A question that needs a yes. It fades and scales in, its icon settles with a spring, and Enter says yes. Use through `useConfirm`. */
export function ConfirmDialog({ open, options, onAnswer }: { open: boolean; options: ConfirmOptions | null; onAnswer: (yes: boolean) => void }) {
  const o = options
  const danger = o?.tone === 'danger'
  const Icon = danger ? Trash2 : HelpCircle
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onAnswer(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        {o && (
          <>
            <DialogHeader className="items-center text-center">
              <motion.span
                initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={spring.snappy}
                className={cn('flex size-12 items-center justify-center rounded-2xl', danger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground')}
              >
                <Icon className="size-6" />
              </motion.span>
              <DialogTitle className="font-display text-3xl font-normal tracking-tight">{o.title}</DialogTitle>
              {o.highlight && (
                <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: 0.06 }} className="text-2xl font-semibold tabular-nums">
                  {o.highlight}
                </motion.p>
              )}
              {o.description && <DialogDescription className="text-balance">{o.description}</DialogDescription>}
            </DialogHeader>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: 0.1 }} className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => onAnswer(false)} className="sm:order-1">
                {o.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={danger ? 'destructive' : 'default'} onClick={() => onAnswer(true)} autoFocus className="sm:order-2">
                {o.confirmLabel ?? 'Yes'}
              </Button>
            </motion.div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
