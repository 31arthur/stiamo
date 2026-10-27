import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pendingActions, searchEntries } from '@/domain/diary/Diary'
import type { DiaryKind } from '@/domain/diary/Diary'
import { useEditor } from '@/presentation/app/create'
import { NativeSelect, Segmented } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { DiaryEntryCard } from '@/presentation/diary/DiaryEntryCard'
import { newDiaryEntry } from '@/presentation/forms/DiaryForm'

type Filter = DiaryKind | 'all'

/** Every diary entry across all cases, newest first: the journal of the practice. */
export function DiaryPage() {
  const { open } = useEditor()
  const today = useToday()
  const { data: entries } = useEntities('diary')
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: tasks } = useEntities('task')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Filter>('all')
  const [caseId, setCaseId] = useState('')

  const rows = useMemo(() => {
    const filtered = entries.filter((e) => (kind === 'all' || e.kind === kind) && (!caseId || e.caseId === caseId))
    return searchEntries(filtered, query).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  }, [entries, kind, caseId, query])

  const withOpenWork = entries.filter((e) => pendingActions(e, tasks).length > 0).length
  const month = today.slice(0, 7)

  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Case diary"
        description="What happened on every date, and the work it left behind. Recording a hearing writes its entry; add chamber work here or from a case."
        actions={
          <Button onClick={() => open({ kind: 'diary', value: newDiaryEntry(today) })}>
            <Plus /> Add entry
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Entries" value={entries.length} />
        <Stat label="This month" value={entries.filter((e) => e.date.startsWith(month)).length} />
        <Stat label="With work still open" value={withOpenWork} tone={withOpenWork ? 'warning' : 'default'} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Filter> label="Kind" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'court', label: 'Court' }, { value: 'chamber', label: 'Chambers' }]} />
        <NativeSelect aria-label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="h-9 w-full sm:w-64">
          <option value="">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.reference} — {c.title}
            </option>
          ))}
        </NativeSelect>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders, authorities, notes…" aria-label="Search the diary" className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
        </div>
      </div>

      {rows.length === 0 ? (
        <Section>
          <EmptyState title={entries.length ? 'No match.' : 'The diary is empty.'} action={entries.length ? undefined : <Button onClick={() => open({ kind: 'diary', value: newDiaryEntry(today) })}>Add an entry</Button>}>
            {entries.length ? 'Try a different search or filter.' : 'Record a hearing on a case, or add chamber work, and it appears here.'}
          </EmptyState>
        </Section>
      ) : (
        <ul className="grid gap-2 xl:grid-cols-2">
          <AnimatePresence initial={false}>
            {rows.map((e) => (
              <DiaryEntryCard key={e.id} entry={e} legalCase={cases.find((c) => c.id === e.caseId)} hearing={hearings.find((h) => h.id === e.hearingId)} tasks={tasks} today={today} showCase />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  )
}
