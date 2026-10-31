import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSettings, PromptPackage, PromptSettings, ToolOverride } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { useAgentAction, useAgentSettings } from './useAgent'

/** Edit exactly what the agent is told: its instructions, how your question is wrapped, and each tool it may use. */
export function PromptPage() {
  const { settings, loading, error } = useAgentSettings()
  if (loading) return <Spinner label="Loading" />
  if (!settings) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null
  // Saving (or resetting) changes the saved prompt, which starts the editor again from what was saved.
  return <PromptEditor key={JSON.stringify(settings.prompt)} settings={settings} />
}

const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** Only what differs from the defaults is stored. */
const compact = (tools: Record<string, ToolOverride>): Record<string, ToolOverride> =>
  Object.fromEntries(Object.entries(tools).filter(([, t]) => !t.enabled || !!t.description?.trim()).map(([k, t]) => [k, { enabled: t.enabled, description: t.description?.trim() || null }]))

function PromptEditor({ settings }: { settings: AgentSettings }) {
  const { agent } = useServices()
  const userId = useUserId()
  const saved = settings.prompt
  const [system, setSystem] = useState(saved.system)
  const [inputTemplate, setInputTemplate] = useState(saved.inputTemplate)
  const [tools, setTools] = useState<Record<string, ToolOverride>>(saved.tools)
  const [question, setQuestion] = useState('Which cases have a hearing this week?')
  const [pkg, setPkg] = useState<PromptPackage | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const focus = useRef<{ get: () => HTMLTextAreaElement | null; set: (v: string) => void }>(null)
  const systemRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const draft: PromptSettings = { system, inputTemplate, tools: compact(tools) }
  const dirty = system !== saved.system || inputTemplate !== saved.inputTemplate || JSON.stringify(compact(tools)) !== JSON.stringify(compact(saved.tools))
  const isDefault = saved.system === settings.defaults.system && saved.inputTemplate === settings.defaults.inputTemplate && Object.keys(compact(saved.tools)).length === 0

  const save = useAgentAction((a, p: PromptSettings) => a.setPrompt(p), { success: 'Prompt saved' })
  const reset = useAgentAction((a) => a.resetPrompt(), { success: 'Back to the default prompt' })

  // What each tool is by default, so an override can be judged against it.
  const defaults = useQuery({
    queryKey: ['agent', 'tool-defaults', userId, settings.decision.enabled],
    queryFn: () => agent.preview('', { system: settings.defaults.system, inputTemplate: settings.defaults.inputTemplate, tools: {} }),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const insert = (name: string) => {
    const area = (focus.current?.get() ?? systemRef.current)!
    const set = area === inputRef.current ? setInputTemplate : setSystem
    const at = area.selectionStart ?? area.value.length
    const end = area.selectionEnd ?? at
    set(`${area.value.slice(0, at)}{{${name}}}${area.value.slice(end)}`)
    requestAnimationFrame(() => {
      area.focus()
      const pos = at + name.length + 4
      area.setSelectionRange(pos, pos)
    })
  }

  async function preview() {
    setPreviewing(true)
    setPreviewError(null)
    try {
      setPkg(await agent.preview(question, draft))
    } catch (e) {
      setPkg(null)
      setPreviewError(e instanceof Error ? e.message : 'Couldn’t build the preview.')
    } finally {
      setPreviewing(false)
    }
  }

  const patchTool = (name: string, p: Partial<ToolOverride>) => setTools((t) => ({ ...t, [name]: { ...(t[name] ?? { enabled: true }), ...p } }))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid gap-4">
        <Section title="Instructions" description="What the agent is told before every question. Use {{variables}} to bring in today’s date, who is asking, the tools and more.">
          <textarea
            ref={systemRef}
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            onFocus={() => (focus.current = { get: () => systemRef.current, set: setSystem })}
            rows={16}
            spellCheck={false}
            aria-label="Instructions"
            className={AREA}
          />
        </Section>

        <Section title="Your question, as sent" description="How what you type is wrapped before it reaches the model. It must contain {{input}}.">
          <textarea
            ref={inputRef}
            value={inputTemplate}
            onChange={(e) => setInputTemplate(e.target.value)}
            onFocus={() => (focus.current = { get: () => inputRef.current, set: setInputTemplate })}
            rows={3}
            spellCheck={false}
            aria-label="Input template"
            className={AREA}
          />
        </Section>

        <Section title="Tools" description="Switch a tool off to take it away from the agent, or reword what it is told the tool is for.">
          {defaults.isLoading ? (
            <Spinner label="Loading tools" />
          ) : (
            <ul className="grid gap-3">
              {defaults.data?.tools.map((t) => {
                const o = tools[t.name] ?? { enabled: true }
                return (
                  <li key={t.name} className="grid gap-1.5 rounded-xl border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={o.enabled} onChange={(e) => patchTool(t.name, { enabled: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
                      <code className="font-mono text-[13px]">{t.name}</code>
                    </label>
                    <textarea
                      value={o.description ?? ''}
                      onChange={(e) => patchTool(t.name, { description: e.target.value })}
                      placeholder={t.description}
                      rows={2}
                      disabled={!o.enabled}
                      aria-label={`Description of ${t.name}`}
                      className={`${AREA} font-sans text-xs disabled:opacity-50`}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!dirty || save.pending} onClick={() => void save.run(draft)}>
            <Save /> Save prompt
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setSystem(saved.system)
                setInputTemplate(saved.inputTemplate)
                setTools(saved.tools)
              }}
            >
              Discard changes
            </Button>
          )}
          <Button variant="outline" disabled={isDefault || reset.pending} onClick={() => void reset.run(undefined)} className="ml-auto">
            <RotateCcw /> Reset to default
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        </div>
      </div>

      <div className="grid content-start gap-4 lg:sticky lg:top-4">
        <Section title="Variables" description="Click one to put it where your cursor is.">
          <ul className="grid gap-2">
            {Object.entries(settings.variables).map(([name, what]) => (
              <li key={name}>
                <button type="button" onClick={() => insert(name)} className="group w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50">
                  <code className="font-mono text-xs font-medium">{`{{${name}}}`}</code>
                  <span className="block text-[11px] text-muted-foreground">{what}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="The whole package" description="Exactly what would be sent to the model for a question, with your unsaved edits.">
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="A question to preview" />
              <Button variant="outline" onClick={() => void preview()} disabled={previewing}>
                {previewing ? <Spinner size="xs" tone="current" decorative /> : <Eye />} Preview
              </Button>
            </div>
            {previewError && (
              <p role="alert" className="text-xs text-destructive">
                {previewError}
              </p>
            )}
            {pkg && (
              <div className="grid gap-3 text-xs">
                <Block title="System prompt" body={pkg.system} />
                <Block title="Message" body={pkg.user} />
                <div>
                  <div className="mb-1 font-semibold tracking-widest text-muted-foreground uppercase">Tools · {pkg.tools.length}</div>
                  <ul className="grid gap-1">
                    {pkg.tools.map((t) => (
                      <li key={t.name}>
                        <details className="rounded-lg border px-2.5 py-1.5">
                          <summary className="cursor-pointer font-mono">{t.name}</summary>
                          <p className="mt-1 text-muted-foreground">{t.description}</p>
                          <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 text-[11px]">{JSON.stringify(t.parameters, null, 2)}</pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-1 font-semibold tracking-widest text-muted-foreground uppercase">{title}</div>
      <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">{body}</pre>
    </div>
  )
}
