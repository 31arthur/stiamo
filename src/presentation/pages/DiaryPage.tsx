import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { diaryOf, pendingActions, searchDiary, touchesCase } from '@/domain/cases/hearingDiary'
import { hearingCaseIds } from '@/domain/cases/LegalCase'
import { NativeSelect } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { HearingRecordDetails } from '@/presentation/diary/HearingRecordDetails'
import { spring } from '@/presentation/motion/presets'

/**
 * The case diary across every case, newest first. It is not a second record: each entry is a
 * hearing that has been written up, and a hearing taken up for several cases appears once.
 */
export function DiaryPage() {
  const today = useToday()
  const { data: hearings } = useEntities('hearing')
  const { data: cases } = useEntities('case')
  const { data: tasks } = useEntities('task')
  const [query, setQuery] = useState('')
  const [caseId, setCaseId] = useState('')

  const entries = useMemo(() => diaryOf(hearings), [hearings])
  const rows = useMemo(() => searchDiary(entries.filter((h) => !caseId || touchesCase(h, caseId)), cases, query), [entries, cases, caseId, query])
  const withOpenWork = entries.filter((h) => pendingActions(h, tasks).length > 0).length
  const month = today.slice(0, 7)

  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Case diary"
        description="What happened on every date, and the work it left behind. It is the hearing record itself: write a hearing up from its case and it appears here, once, even if it covered several cases."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Entries" value={entries.length} />
        <Stat label="This month" value={entries.filter((h) => h.date.startsWith(month)).length} />
        <Stat label="With work still open" value={withOpenWork} tone={withOpenWork ? 'warning' : 'default'} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="h-9 w-full sm:w-72">
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
          <EmptyState title={entries.length ? 'No match.' : 'The diary is empty.'}>
            {entries.length ? 'Try a different search or case.' : 'Open a case and record a hearing; its write-up is the diary entry.'}
          </EmptyState>
        </Section>
      ) : (
        <ul className="grid gap-2 xl:grid-cols-2">
          {rows.map((h) => (
            <motion.li key={h.id} layout transition={spring.soft} className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold tabular-nums">{format(parseISO(h.date), 'EEE d MMM yyyy')}</span>
                {hearingCaseIds(h).map((id) => {
                  const c = cases.find((x) => x.id === id)
                  return c ? (
                    <Link key={id} to={`/cases/${id}`} className="font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                      {c.reference}
                    </Link>
                  ) : null
                })}
              </div>
              <div className="text-sm">{h.purpose}</div>
              <div className="truncate text-xs text-muted-foreground">
                {hearingCaseIds(h)
                  .map((id) => cases.find((x) => x.id === id)?.title)
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <HearingRecordDetails hearing={h} next={hearings.find((x) => x.id === h.nextHearingId)} tasks={tasks} today={today} />
            </motion.li>
          ))}
        </ul>
      )}
    </>
  )
}
