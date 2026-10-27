import { useMemo } from 'react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import type { EntityKind, EntityRef } from '@/domain/shared/types'
import { KIND_META } from '@/presentation/components/kinds'
import type { RecordInfo } from '@/presentation/components/records'
import { useRecordLookup } from '@/presentation/components/records'
import { WorkspaceDot } from '@/presentation/components/workspace'

const ORDER: EntityKind[] = ['case', 'client', 'project', 'counsel', 'meeting', 'hearing', 'plan', 'goal', 'task', 'followUp']

/** Search every record and pick one to link to `from`. */
export function LinkPicker({ open, onOpenChange, from, exclude, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; from: EntityRef; exclude: EntityRef[]; onPick: (target: RecordInfo) => void }) {
  const { all } = useRecordLookup()
  const groups = useMemo(() => {
    const skip = new Set([from, ...exclude].map((r) => `${r.kind}:${r.id}`))
    const items = [...all.values()].filter((i) => !skip.has(`${i.ref.kind}:${i.ref.id}`))
    return ORDER.map((kind) => ({ kind, items: items.filter((i) => i.ref.kind === kind) })).filter((g) => g.items.length)
  }, [all, from, exclude])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Link a record" className="sm:max-w-xl">
      <Command>
        <CommandInput placeholder="Search cases, clients, projects, meetings, hearings, plans, goals, tasks…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nothing matches.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.kind} heading={KIND_META[g.kind].plural}>
              {g.items.map((i) => (
                <CommandItem
                  key={`${i.ref.kind}:${i.ref.id}`}
                  value={`${i.kindLabel} ${i.title} ${i.subtitle ?? ''} ${i.ref.id}`}
                  onSelect={() => {
                    onPick(i)
                    onOpenChange(false)
                  }}
                >
                  <i.icon />
                  {i.workspace && <WorkspaceDot ws={i.workspace} />}
                  <span className="truncate">{i.title}</span>
                  {i.subtitle && <CommandShortcut>{i.subtitle}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
