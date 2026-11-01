import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, ClipboardPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ProposalHit } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'

type State = 'pending' | 'saving' | 'applied' | 'dropped'

/** What an agent suggests adding or changing: exactly what would be saved, and nothing is until you approve. */
export function ProposalCards({ proposals }: { proposals: ProposalHit[] }) {
  return (
    <section aria-label="Proposed changes" className="grid gap-1.5">
      <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">To approve · {proposals.length}</h3>
      <ul className="grid gap-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </ul>
    </section>
  )
}

function ProposalCard({ proposal: p }: { proposal: ProposalHit }) {
  const { agent } = useServices()
  const [state, setState] = useState<State>('pending')

  async function decide(approve: boolean) {
    setState('saving')
    try {
      await (approve ? agent.approveProposal(p.id) : agent.dropProposal(p.id))
      setState(approve ? 'applied' : 'dropped')
      if (approve) toast.success('Saved', { description: p.title })
    } catch (e) {
      setState('pending')
      toast.error(approve ? 'Couldn’t save it' : 'Couldn’t drop it', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card/80 p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{state === 'applied' ? <Check className="size-3.5" /> : <ClipboardPlus className="size-3.5" />}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium break-words">{p.title}</div>
          {p.lines.length > 0 && (
            <ul className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
              {p.lines.map((l, i) => (
                <li key={i} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 pl-8.5">
        {state === 'applied' ? (
          <span className="text-xs font-medium text-success">Saved</span>
        ) : state === 'dropped' ? (
          <span className="text-xs text-muted-foreground">Dropped</span>
        ) : (
          <>
            <Button size="xs" onClick={() => void decide(true)} disabled={state === 'saving'}>
              {state === 'saving' ? <Spinner size="xs" tone="current" decorative /> : <Check />} Approve
            </Button>
            <Button size="xs" variant="ghost" onClick={() => void decide(false)} disabled={state === 'saving'}>
              <X /> Not this
            </Button>
          </>
        )}
      </div>
    </motion.li>
  )
}
