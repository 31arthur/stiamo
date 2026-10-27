import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { NotebookPen, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { entriesOf, searchEntries } from '@/domain/diary/Diary'
import type { LegalCase } from '@/domain/cases/LegalCase'
import { useEditor } from '@/presentation/app/create'
import { Section } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { newDiaryEntry } from '@/presentation/forms/DiaryForm'
import { DiaryEntryCard } from './DiaryEntryCard'

/** The case's diary, newest first, searchable — "what did the bench say about limitation?" */
export function CaseDiary({ legalCase: c }: { legalCase: LegalCase }) {
  const { open } = useEditor()
  const today = useToday()
  const { data: entries } = useEntities('diary')
  const { data: hearings } = useEntities('hearing')
  const { data: tasks } = useEntities('task')
  const [query, setQuery] = useState('')

  const mine = useMemo(() => entriesOf(c.id, entries), [c.id, entries])
  const shown = useMemo(() => searchEntries(mine, query), [mine, query])

  return (
    <Section
      title="Case diary"
      description={mine.length ? `${mine.length} ${mine.length === 1 ? 'entry' : 'entries'} · court and chamber` : 'What happened on each date, and what to do next'}
      actions={
        <Button variant="outline" size="sm" onClick={() => open({ kind: 'diary', value: newDiaryEntry(today, { caseId: c.id }) })}>
          <Plus /> Add entry
        </Button>
      }
    >
      {mine.length === 0 ? (
        <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
          <p>
            Recording a hearing writes its diary entry. Add chamber work — a conference, a draft, research — here, so the whole file reads in order.
          </p>
          <Button variant="ghost" size="sm" onClick={() => open({ kind: 'diary', value: newDiaryEntry(today, { caseId: c.id }) })}>
            <NotebookPen /> Write the first entry
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {mine.length > 3 && (
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the diary…" aria-label="Search the case diary" className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
            </div>
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the diary matches.</p>
          ) : (
            <ul className="grid gap-2">
              <AnimatePresence initial={false}>
                {shown.map((e) => (
                  <DiaryEntryCard key={e.id} entry={e} hearing={hearings.find((h) => h.id === e.hearingId)} tasks={tasks} today={today} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}
