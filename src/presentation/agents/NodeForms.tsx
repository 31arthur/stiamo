import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AgentGraph, GraphNode } from '@/domain/ai/AgentApi'
import type { AiSelection } from '@/domain/ai/types'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import { ModelChoice } from './ModelPicker'
import { PromptEditor } from './PromptEditor'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const OPS: [string, string][] = [
  ['contains', 'contains'],
  ['not_contains', 'doesn’t contain'],
  ['equals', 'is'],
  ['not_equals', 'is not'],
  ['matches', 'matches (pattern)'],
  ['empty', 'is empty'],
  ['not_empty', 'isn’t empty'],
  ['gt', 'is more than'],
  ['lt', 'is less than'],
]
const VARS = ['input', 'answer', 'workspace', 'found', 'steps']

export interface Cond {
  var: string
  op: string
  value?: string
  label?: string
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
    {label}
    {children}
    {hint && <span className="text-[11px] font-normal">{hint}</span>}
  </label>
)

/** One condition: a value of the run so far, what to compare it with, and (for a branch) the label of the edge it takes. */
function CondRow({ c, onChange, withLabel, onRemove }: { c: Cond; onChange: (c: Cond) => void; withLabel?: boolean; onRemove?: () => void }) {
  const noValue = c.op === 'empty' || c.op === 'not_empty'
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
      <span className="text-xs text-muted-foreground">If</span>
      <input list="graph-vars" aria-label="Value to check" value={c.var} onChange={(e) => onChange({ ...c, var: e.target.value })} className={`${SELECT} w-28`} />
      <select aria-label="Comparison" value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value })} className={SELECT}>
        {OPS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {!noValue && <Input aria-label="Compared with" value={c.value ?? ''} onChange={(e) => onChange({ ...c, value: e.target.value })} className="h-8 w-32" />}
      {withLabel && (
        <>
          <span className="text-xs text-muted-foreground">→ edge</span>
          <Input aria-label="Edge label" value={c.label ?? ''} onChange={(e) => onChange({ ...c, label: e.target.value.replace(/\s+/g, '-').toLowerCase() })} className="h-8 w-24" />
        </>
      )}
      {onRemove && (
        <Button variant="ghost" size="icon-xs" aria-label="Remove this condition" onClick={onRemove}>
          <Trash2 />
        </Button>
      )}
      <datalist id="graph-vars">
        {VARS.map((v) => (
          <option key={v} value={v} />
        ))}
        <option value="vars.name" />
      </datalist>
    </div>
  )
}

/** The settings of one node, by its type. Each change goes to `set`, which merges it into the node's config. */
export function NodeForm({ node, graph, set }: { node: GraphNode; graph: AgentGraph; set: (patch: Record<string, unknown>) => void }) {
  const c = node.config
  switch (node.type) {
    case 'trigger':
      return (
        <div className="grid gap-1.5 text-sm">
          <p className="text-muted-foreground">Every run starts here, with what was asked. This agent is started by:</p>
          <ul className="grid gap-1">
            {graph.triggers.map((t) => (
              <li key={t} className="rounded-lg border px-2.5 py-1.5">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'scope':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Limits what the nodes after it can see. Nothing from another workspace reaches the model.</p>
          <Field label="Which workspace">
            <select className={SELECT} value={String(c.mode ?? 'inherit')} onChange={(e) => set({ mode: e.target.value, workspace: e.target.value === 'fixed' ? (c.workspace ?? 'sb') : undefined })}>
              <option value="inherit">The one the message is about (the chat’s)</option>
              <option value="fixed">Always the same one…</option>
            </select>
          </Field>
          {c.mode === 'fixed' && (
            <select aria-label="Workspace" className={SELECT} value={String(c.workspace ?? 'sb')} onChange={(e) => set({ workspace: e.target.value })}>
              {WORKSPACE_IDS.map((id) => (
                <option key={id} value={id}>
                  {WORKSPACES[id].name}
                </option>
              ))}
            </select>
          )}
        </div>
      )
    case 'prompt':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">What the model is told. Leave these empty to use the agent’s saved prompt (below); write one to use it in this workflow instead.</p>
          <Field label="Instructions (system prompt)" hint={`Variables: ${Object.keys(graph.variables).map((v) => `{{${v}}}`).join(' ') || 'none'}`}>
            <textarea rows={6} className={AREA} value={String(c.system ?? '')} placeholder={graph.defaults.system.slice(0, 160) + '…'} onChange={(e) => set({ system: e.target.value || undefined })} />
          </Field>
          <Field label="How the message is wrapped" hint="Must contain {{input}}.">
            <textarea rows={3} className={AREA} value={String(c.inputTemplate ?? '')} placeholder={graph.defaults.inputTemplate} onChange={(e) => set({ inputTemplate: e.target.value || undefined })} />
          </Field>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">The agent’s saved prompt</summary>
            <div className="mt-3">
              <PromptEditor agentId={graph.agentId} />
            </div>
          </details>
        </div>
      )
    case 'agent': {
      const tools = c.tools as string[] | undefined
      const on = (name: string) => (tools ? tools.includes(name) : graph.tools.find((t) => t.name === name)?.enabled !== false)
      const flip = (name: string) => {
        const base = tools ?? graph.tools.filter((t) => t.enabled).map((t) => t.name)
        set({ tools: base.includes(name) ? base.filter((x) => x !== name) : [...base, name] })
      }
      return (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">The model: it reads, calls the tools below as it needs, and answers.</p>
          <Field label="Message it is given" hint="{{input}} is what was asked; {{answer}} is the last answer in the workflow; {{vars.name}} a value you stored.">
            <Input value={String(c.input ?? '{{input}}')} onChange={(e) => set({ input: e.target.value })} />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Model</span>
            <ModelChoice value={(c.model as AiSelection | null | undefined) ?? null} onChange={(s) => set({ model: s })} />
            <div>
              <Button variant="ghost" size="xs" disabled={!c.model} onClick={() => set({ model: undefined })}>
                Use the agent’s own model
              </Button>
            </div>
          </div>
          <Field label="Most tool calls per answer">
            <Input type="number" min={1} max={20} value={String(c.maxSteps ?? '')} placeholder="The default" className="w-32" onChange={(e) => set({ maxSteps: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={c.history !== false} onChange={(e) => set({ history: e.target.checked ? undefined : false })} />
            Knows the conversation so far
          </label>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tools it may call{tools ? ` · ${tools.length} of ${graph.tools.length}` : ' · all that are on'}</span>
            <ul className="flex flex-wrap gap-1.5">
              {graph.tools.map((t) => (
                <li key={t.name}>
                  <button type="button" aria-pressed={on(t.name)} title={t.description} onClick={() => flip(t.name)} className={`rounded-lg border px-2 py-1 font-mono text-[11px] ${on(t.name) ? 'border-foreground bg-muted' : 'text-muted-foreground line-through'}`}>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
            {tools && (
              <div>
                <Button variant="ghost" size="xs" onClick={() => set({ tools: undefined })}>
                  Back to all that are on
                </Button>
              </div>
            )}
          </div>
        </div>
      )
    }
    case 'branch': {
      const cases = (c.cases as Cond[] | undefined) ?? []
      const upd = (i: number, next: Cond) => set({ cases: cases.map((x, j) => (j === i ? next : x)) })
      return (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Follows the first case that holds, else the edge labelled “else”. Draw an edge from this node for each case label.</p>
          {cases.map((k, i) => (
            <CondRow key={i} c={k} withLabel onChange={(x) => upd(i, x)} onRemove={cases.length > 1 ? () => set({ cases: cases.filter((_, j) => j !== i) }) : undefined} />
          ))}
          <Button variant="outline" size="xs" className="w-fit" onClick={() => set({ cases: [...cases, { var: 'input', op: 'contains', value: '', label: `case-${cases.length + 1}` }] })}>
            <Plus /> Add a case
          </Button>
        </div>
      )
    }
    case 'set':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Stores a value for later nodes to use as {'{{vars.name}}'}.</p>
          <Field label="Name">
            <Input value={String(c.name ?? '')} onChange={(e) => set({ name: e.target.value.replace(/[^\w]/g, '') })} className="w-48" />
          </Field>
          <Field label="Value" hint="Can use {{input}}, {{answer}}, {{workspace}} and other values.">
            <Input value={String(c.value ?? '')} onChange={(e) => set({ value: e.target.value })} />
          </Field>
        </div>
      )
    case 'loop': {
      const until = c.until as Cond | undefined
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Goes back round (edge “again”) until the condition holds or it has gone round enough, then continues (edge “done”).</p>
          <Field label="Most rounds">
            <Input type="number" min={1} max={8} value={String(c.max ?? 3)} className="w-24" onChange={(e) => set({ max: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })} />
          </Field>
          {until ? (
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Stop early when</span>
              <CondRow c={until} onChange={(x) => set({ until: x })} onRemove={() => set({ until: undefined })} />
            </div>
          ) : (
            <Button variant="outline" size="xs" className="w-fit" onClick={() => set({ until: { var: 'answer', op: 'contains', value: '' } })}>
              <Plus /> Stop early when…
            </Button>
          )}
        </div>
      )
    }
    default:
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Ends the run. By default the last answer is given; write a template to shape it.</p>
          <Field label="Answer template" hint="Leave empty for the last answer. Example: ✅ {{answer}}">
            <Input value={String(c.template ?? '')} placeholder="{{answer}}" onChange={(e) => set({ template: e.target.value || undefined })} />
          </Field>
        </div>
      )
  }
}
