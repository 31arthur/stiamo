import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Network } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { useNavigate } from '@/presentation/routing'

/** Make a new agent from a workflow: pick a template (a workflow that already works), name it, and open it on the canvas to change. */
export function NewFromWorkflow({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const navigate = useNavigate()
  const catalog = useQuery({ queryKey: ['agent', 'flow-catalog'], queryFn: () => agent.flowCatalog(), enabled: open, staleTime: 5 * 60_000, retry: false })
  const [picked, setPicked] = useState('assistant')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const template = catalog.data?.templates.find((t) => t.id === picked)

  async function create() {
    setBusy(true)
    try {
      const made = await agent.createAgent({ name: name.trim() || template?.name || 'New agent', templateId: picked })
      await client.invalidateQueries({ queryKey: ['agent'] })
      toast.success(`“${made.name}” created`, { description: 'It uses the model you chose last, until you give it its own.' })
      onOpenChange(false)
      setName('')
      navigate(`/agents/${made.id}/workflow`)
    } catch (e) {
      toast.error('Couldn’t create it', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New agent from a workflow</DialogTitle>
          <DialogDescription>Start from one that already works, then change it node by node.</DialogDescription>
        </DialogHeader>
        {catalog.isLoading ? (
          <Spinner label="Loading" />
        ) : (
          <div className="grid gap-4">
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Templates">
              {(catalog.data?.templates ?? []).map((t) => (
                <li key={t.id}>
                  <button type="button" aria-pressed={picked === t.id} onClick={() => setPicked(t.id)} className={cn('grid h-full w-full gap-1 rounded-xl border p-3 text-left text-sm transition-colors', picked === t.id ? 'border-foreground bg-muted/50' : 'hover:border-foreground/40')}>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Network className="size-3.5 text-muted-foreground" /> {t.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                    <span className="text-[11px] text-muted-foreground">{t.flow.nodes.length} nodes</span>
                  </button>
                </li>
              ))}
            </ul>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Name
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={template?.name ?? 'New agent'} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void create()} disabled={busy || !catalog.data}>
                {busy && <Spinner size="xs" tone="current" decorative />} Create
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
