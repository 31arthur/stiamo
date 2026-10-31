import { TOGGLEABLE_PAGES } from '@/domain/shared/pages'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { usePages } from '@/presentation/app/pages'
import { PageHeader, Section } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'

/** Which common pages each workspace shows. Open from "All workspaces". */
export function WorkspacePagesPage() {
  const { hidden, set } = usePages()
  return (
    <>
      <PageHeader eyebrow="All workspaces" title="Workspace pages" description="Each workspace can show just the pages it needs. A page switched off disappears from that workspace’s sidebar; nothing is deleted, and you can switch it back on." />
      <Section bodyClassName="overflow-x-auto p-0">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                Page
              </th>
              {WORKSPACE_IDS.map((ws) => (
                <th key={ws} scope="col" className="px-3 py-3 text-center font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <WorkspaceDot ws={ws} />
                    {WORKSPACES[ws].short}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {TOGGLEABLE_PAGES.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {p.label}
                  {p.hint && <span className="block text-xs font-normal text-muted-foreground">{p.hint}</span>}
                </th>
                {WORKSPACE_IDS.map((ws) => {
                  const on = !hidden[ws]?.includes(p.id)
                  return (
                    <td key={ws} className="px-3 py-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${p.label} in ${WORKSPACES[ws].name}`}
                        onClick={() => set(ws, p.id, !on)}
                        className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', on ? 'bg-foreground' : 'bg-muted-foreground/30')}
                      >
                        <span className={cn('inline-block size-4 rounded-full bg-background shadow transition-transform', on ? 'translate-x-4.5' : 'translate-x-0.5')} />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <p className="text-xs text-muted-foreground">Saved on this device. Mailboxes stay connected when Mail is switched off; they just aren’t shown there.</p>
    </>
  )
}
