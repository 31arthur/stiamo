import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ClipboardCopy, HelpCircle, Lightbulb, ListPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { digestOf } from '@/domain/plans/planDoc'
import type { RichDoc } from '@/domain/shared/types'
import { ProgressBar } from '@/presentation/components/progress'
import { spring } from '@/presentation/motion/presets'

/** Scrolls the editor to a block and flashes it, so a summary line leads back to where it was written. */
function jumpToBlock(id: string) {
  const el = document.querySelector<HTMLElement>(`.bn-editor [data-id="${CSS.escape(id)}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.animate([{ backgroundColor: 'color-mix(in oklch, var(--warning) 30%, transparent)' }, { backgroundColor: 'transparent' }], { duration: 1400, easing: 'ease-out' })
}

/**
 * Pulls the working-out into one place: how many questions are answered, what's still open, and the
 * insights — each of which can become a step with one click.
 */
export function PlanDigestPanel({ doc, stepTitles, onAddStep, className }: { doc: RichDoc | undefined; stepTitles: string[]; onAddStep: (text: string) => Promise<unknown>; className?: string }) {
  const digest = useMemo(() => digestOf(doc), [doc])
  const [adding, setAdding] = useState<string | null>(null)
  const asked = digest.open + digest.answered
  const existing = useMemo(() => new Set(stepTitles.map((t) => t.trim().toLowerCase())), [stepTitles])

  async function addStep(id: string, text: string) {
    setAdding(id)
    try {
      await onAddStep(text.length > 140 ? `${text.slice(0, 137)}…` : text)
    } finally {
      setAdding(null)
    }
  }

  async function copyInsights() {
    const text = digest.insights.map((i) => `• ${i.text}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Insights copied')
    } catch {
      toast.error('Couldn’t copy — select the text instead')
    }
  }

  const nothing = digest.questions.length === 0 && digest.insights.length === 0

  return (
    <aside aria-label="Summary of the working-out" className={cn('grid content-start gap-4 rounded-2xl border bg-card/70 p-4', className)}>
      <div>
        <div className="flex items-center justify-between text-sm font-semibold">
          Working it out
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{asked ? `${digest.answered}/${asked} answered` : '—'}</span>
        </div>
        {asked > 0 && <ProgressBar value={digest.answered / asked} className="mt-2" barClassName="bg-success" />}
      </div>

      {nothing && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Think on the page: type <kbd className="rounded border bg-muted px-1">??</kbd> then a space to ask a question, press Enter to answer it, and <kbd className="rounded border bg-muted px-1">!!</kbd> for an insight. They gather here.
        </p>
      )}

      {digest.questions.some((q) => q.status !== 'answered') && (
        <section className="grid gap-1.5">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <HelpCircle className="size-3.5" /> Still to answer
          </h3>
          <ul className="grid gap-1">
            {digest.questions
              .filter((q) => q.status !== 'answered')
              .map((q) => (
                <li key={q.id}>
                  <button type="button" onClick={() => jumpToBlock(q.id)} className={cn('w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted', q.status === 'parked' && 'text-muted-foreground')}>
                    {q.text}
                    {q.status === 'parked' && <span className="ml-1.5 text-[10px] tracking-wide uppercase">parked</span>}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {digest.insights.length > 0 && (
        <section className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <Lightbulb className="size-3.5" /> Insights <span className="tabular-nums">{digest.insights.length}</span>
            </h3>
            <Button variant="ghost" size="xs" onClick={copyInsights}>
              <ClipboardCopy /> Copy
            </Button>
          </div>
          <ul className="grid gap-1.5">
            <AnimatePresence initial={false}>
              {digest.insights.map((i) => {
                const isStep = existing.has(i.text.trim().toLowerCase())
                return (
                  <motion.li key={i.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft} className="rounded-xl border border-warning/25 bg-warning/8 p-2.5">
                    <button type="button" onClick={() => jumpToBlock(i.id)} className="block w-full text-left text-sm leading-snug">
                      {i.text}
                    </button>
                    <Button variant="ghost" size="xs" className="mt-1.5 -ml-1" disabled={isStep || adding === i.id} onClick={() => addStep(i.id, i.text)}>
                      {isStep ? (
                        <>
                          <Check /> Already a step
                        </>
                      ) : (
                        <>
                          <ListPlus /> Add as a step
                        </>
                      )}
                    </Button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </section>
      )}
    </aside>
  )
}
