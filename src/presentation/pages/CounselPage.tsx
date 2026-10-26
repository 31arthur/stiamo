import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { HeartHandshake, MapPin, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CASE_TYPES } from '@/domain/cases/LegalCase'
import { COUNSEL_KIND_LABELS, counselLabel } from '@/domain/counsel/Counsel'
import type { CounselKind } from '@/domain/counsel/Counsel'
import { useEditor } from '@/presentation/app/create'
import { Segmented } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { useEntities } from '@/presentation/data/hooks'
import { stagger } from '@/presentation/motion/presets'

export const initials = (name: string) =>
  name
    .replace(/^adv\.?\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function CounselPage() {
  const { open } = useEditor()
  const { data: counsel } = useEntities('counsel')
  const { data: cases } = useEntities('case')
  const [kind, setKind] = useState<CounselKind | 'all'>('all')
  const [proBono, setProBono] = useState(false)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return counsel
      .filter((c) => (kind === 'all' || c.kind === kind) && (!proBono || c.proBono))
      .filter((c) => !q || [c.name, c.firm, c.city, c.courts, c.notes, ...c.expertise.map((t) => CASE_TYPES[t]?.label)].filter(Boolean).join(' ').toLowerCase().includes(q))
      .map((c) => ({ c, active: cases.filter((x) => x.engagement?.counselId === c.id && (x.status === 'active' || x.status === 'on_hold')).length, total: cases.filter((x) => x.engagement?.counselId === c.id).length }))
      .sort((a, b) => Number(b.c.status === 'active') - Number(a.c.status === 'active') || b.active - a.active || a.c.name.localeCompare(b.c.name))
  }, [counsel, cases, kind, proBono, query])

  const briefed = cases.filter((c) => c.engagement && (c.status === 'active' || c.status === 'on_hold')).length
  const activeCases = cases.filter((c) => c.status === 'active' || c.status === 'on_hold').length

  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Counsel"
        description="Outside advocates and law firms you know. Most cases are handled by us; when one isn’t, brief someone from here and keep the terms with the case."
        actions={
          <Button onClick={() => open({ kind: 'counsel' })}>
            <Plus /> Add counsel
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="In your directory" value={counsel.length} />
        <Stat label="Cases with counsel" value={briefed} />
        <Stat label="Handled by us" value={activeCases - briefed} tone="success" />
        <Stat label="Take pro bono" value={counsel.filter((c) => c.proBono).length} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<CounselKind | 'all'> label="Kind" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'advocate', label: 'Advocates' }, { value: 'firm', label: 'Law firms' }]} />
        <button
          type="button"
          aria-pressed={proBono}
          onClick={() => setProBono(!proBono)}
          className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors', proBono ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          <HeartHandshake className="size-3.5" /> Pro bono
        </button>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, city, court…" aria-label="Search counsel" className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
        </div>
      </div>

      {rows.length === 0 ? (
        <Section>
          <EmptyState title={counsel.length ? 'No match.' : 'No counsel yet.'} action={counsel.length ? undefined : <Button onClick={() => open({ kind: 'counsel' })}>Add counsel</Button>}>
            {counsel.length ? 'Try a different filter.' : 'Add the advocates and law firms you work with, then brief them on cases from the case page.'}
          </EmptyState>
        </Section>
      ) : (
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, active, total }) => (
            <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
              <Link to={`/counsel/${c.id}`} className={cn('group flex h-full flex-col gap-3 rounded-2xl border bg-card/80 p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-float', c.status === 'inactive' && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ws-sb-soft text-sm font-semibold text-ws-sb">{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{counselLabel(c)}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{COUNSEL_KIND_LABELS[c.kind]}</span>
                      {c.city && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="size-3" /> {c.city}
                        </span>
                      )}
                      {c.status === 'inactive' && <span className="rounded bg-muted px-1.5">Not available</span>}
                    </div>
                  </div>
                  {c.proBono && (
                    <span title="Takes pro bono matters" className="shrink-0 text-ws-media">
                      <HeartHandshake className="size-4" />
                    </span>
                  )}
                </div>
                {c.courts && <p className="line-clamp-1 text-xs text-muted-foreground">{c.courts}</p>}
                {c.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.expertise.map((t) => (
                      <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                        {CASE_TYPES[t]?.label ?? t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto text-xs text-muted-foreground tabular-nums">{total === 0 ? 'Not briefed on any case yet' : `${active} active · ${total} ${total === 1 ? 'case' : 'cases'} in all`}</div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  )
}
