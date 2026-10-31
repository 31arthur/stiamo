import { useState } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import { PROVIDERS, THINKING_LABELS } from '@/domain/ai/types'
import type { ModelInfo, ProviderId, ThinkingLevel } from '@/domain/ai/types'
import { useAgentAction, useAgentSettings, useModels } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** The default level for a model: a middling one where there is a choice, otherwise whatever it allows. */
const defaultThinking = (m?: ModelInfo): ThinkingLevel => (m?.thinking.includes('medium') ? 'medium' : (m?.thinking[0] ?? 'off'))

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

/** Choose the provider, model and thinking level for one agent. */
export function ModelPicker({ def }: { def: AgentSummary }) {
  const { connected, provider, models, model, thinking } = useAgentModel(def)
  const [picking, setPicking] = useState(false)
  const set = useAgentAction((a, s: { providerId: ProviderId; modelId: string; thinking: ThinkingLevel }) => a.setSelection(def.id, s))

  if (connected.length === 0) return <p className="text-sm text-muted-foreground">Connect a provider first.</p>
  const pick = (m: ModelInfo) => {
    void set.run({ providerId: provider!, modelId: m.id, thinking: defaultThinking(m) })
    setPicking(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Provider" value={provider} onChange={(e) => void set.run({ providerId: e.target.value as ProviderId, modelId: '', thinking: 'off' })} className={SELECT}>
        {connected.map((id) => (
          <option key={id} value={id}>
            {PROVIDERS[id].label}
          </option>
        ))}
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
          <select aria-label="Thinking" value={thinking} onChange={(e) => void set.run({ providerId: provider!, modelId: model.id, thinking: e.target.value as ThinkingLevel })} className={SELECT}>
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
              <CommandItem key={m.id} value={`${m.name} ${m.id}`} onSelect={() => pick(m)}>
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
    </div>
  )
}
