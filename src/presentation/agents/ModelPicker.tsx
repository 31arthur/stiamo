import { useState } from 'react'
import { Brain, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import { PROVIDERS, THINKING_LABELS } from '@/domain/ai/types'
import type { AiSelection, ModelInfo, ProviderId, ThinkingLevel } from '@/domain/ai/types'
import { ProvidersPanel } from './ProvidersPanel'
import { useAgentAction, useAgentSettings, useModels } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const ADD = '__add__'

/** The default level for a model: a middling one where there is a choice, otherwise whatever it allows. */
export const defaultThinking = (m?: ModelInfo): ThinkingLevel => (m?.thinking.includes('medium') ? 'medium' : (m?.thinking[0] ?? 'off'))

/** Which provider, model and thinking level an agent runs on, resolved against what is connected. */
export function useAgentModel(def: AgentSummary) {
  const { connected, loading } = useAgentSettings()
  const sel = def.selection
  const provider: ProviderId | undefined = sel && connected.includes(sel.providerId) ? sel.providerId : connected[0]
  const models = useModels(provider, !!provider)
  const model = models.data?.find((m) => m.id === sel?.modelId)
  const thinking: ThinkingLevel = !model ? (sel?.thinking ?? 'off') : model.thinking.includes(sel!.thinking) ? sel!.thinking : defaultThinking(model)
  return { connected, loading, provider, models, model, thinking, ready: !!sel?.modelId && sel.providerId === provider }
}

/** Add a provider without leaving the page: the same cards as in the agents' settings, in a dialog. */
export function ProvidersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Connect a provider</DialogTitle>
          <DialogDescription>Paste a key; it is checked before it is kept. Then choose a model from it.</DialogDescription>
        </DialogHeader>
        <ProvidersPanel compact />
      </DialogContent>
    </Dialog>
  )
}

/**
 * Choose a provider, a model and how hard it thinks. Used for one agent, for the default of all of them, and anywhere a
 * model is chosen: it can also connect a provider on the spot, so nobody is sent away to do that first.
 */
export function ModelChoice({ value, onChange }: { value: AiSelection | null; onChange: (s: AiSelection) => void }) {
  const { connected } = useAgentSettings()
  const [picking, setPicking] = useState(false)
  const [adding, setAdding] = useState(false)
  const provider: ProviderId | undefined = value && connected.includes(value.providerId) ? value.providerId : connected[0]
  const models = useModels(provider, !!provider)
  const model = models.data?.find((m) => m.id === value?.modelId)
  const thinking: ThinkingLevel = !model ? (value?.thinking ?? 'off') : model.thinking.includes(value!.thinking) ? value!.thinking : defaultThinking(model)

  if (connected.length === 0) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> Connect a provider
        </Button>
        <ProvidersDialog open={adding} onOpenChange={setAdding} />
      </>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Provider"
        value={provider}
        onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange({ providerId: e.target.value as ProviderId, modelId: '', thinking: 'off' }))}
        className={SELECT}
      >
        {connected.map((id) => (
          <option key={id} value={id}>
            {PROVIDERS[id].label}
          </option>
        ))}
        {connected.length < 3 && <option value={ADD}>＋ Add a provider…</option>}
      </select>
      <Button variant="outline" size="sm" className="max-w-full min-w-44 justify-between" onClick={() => setPicking(true)} disabled={models.isLoading || !!models.error}>
        {models.isLoading ? (
          <span className="flex items-center gap-2">
            <Spinner size="xs" tone="current" decorative /> Loading models…
          </span>
        ) : (
          <>
            <span className="truncate">{model?.name ?? 'Choose a model'}</span>
            <ChevronDown />
          </>
        )}
      </Button>
      {model && model.thinking.length > 0 && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Brain className="size-3.5" /> Thinking
          <select aria-label="Thinking" value={thinking} onChange={(e) => onChange({ providerId: provider!, modelId: model.id, thinking: e.target.value as ThinkingLevel })} className={SELECT}>
            {model.thinking.map((l) => (
              <option key={l} value={l}>
                {THINKING_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      )}
      {models.error && (
        <span role="alert" className="text-xs text-destructive">
          {models.error instanceof Error ? models.error.message : 'Couldn’t load the models.'}
        </span>
      )}

      <CommandDialog open={picking} onOpenChange={setPicking} title="Choose a model" description={`Models available from ${provider ? PROVIDERS[provider].label : 'the provider'}`} className="sm:max-w-lg">
        <Command>
          <CommandInput placeholder={`Search ${models.data?.length ?? 0} models…`} />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No model matches.</CommandEmpty>
            {models.data?.map((m) => (
              <CommandItem
                key={m.id}
                value={`${m.name} ${m.id}`}
                onSelect={() => {
                  onChange({ providerId: provider!, modelId: m.id, thinking: defaultThinking(m) })
                  setPicking(false)
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.name}</span>
                  {m.name !== m.id && <span className="block truncate text-[11px] text-muted-foreground">{m.id}</span>}
                </span>
                {m.thinking.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">
                    <Brain className="size-3" /> thinks
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
      <ProvidersDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

/** The model of one agent. */
export function ModelPicker({ def }: { def: AgentSummary }) {
  const set = useAgentAction((a, s: AiSelection) => a.setSelection(def.id, s))
  return <ModelChoice value={def.selection} onChange={(s) => void set.run(s)} />
}
