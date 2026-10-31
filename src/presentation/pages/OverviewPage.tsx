import { useMemo } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildDigests } from '@/domain/shared/digest'
import type { DigestStat, WorkspaceDigest } from '@/domain/shared/digest'
import { fileKind } from '@/domain/drive/Drive'
import { WORKSPACES } from '@/domain/shared/workspace'
import { useAttention } from '@/presentation/app/attention'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { EmptyState, PageHeader, Section } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { FileTypeIcon } from '@/presentation/drive/FileTypeIcon'
import { driveAgo } from '@/presentation/drive/format'
import { useDriveSearch, useDriveStatus } from '@/presentation/drive/useDrive'
import { fadeUp, stagger } from '@/presentation/motion/presets'

const TONE: Record<NonNullable<DigestStat['tone']>, string> = { danger: 'text-destructive', warning: 'text-warning', success: 'text-success' }

/** "All workspaces": a little from each part of your work, with a way into each. */
export function OverviewPage() {
  const today = useToday()
  const attention = useAttention()
  const { setScope } = useWorkspaceFilter()
  const navigate = useNavigate()
  const { data: tasks } = useEntities('task')
  const { data: followUps } = useEntities('followUp')
  const { data: meetings } = useEntities('meeting')
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: clients } = useEntities('client')
  const { data: projects } = useEntities('project')
  const { data: goals } = useEntities('goal')

  const digests = useMemo(() => buildDigests({ tasks, followUps, meetings, cases, hearings, clients, projects, goals }, today), [tasks, followUps, meetings, cases, hearings, clients, projects, goals, today])
  // A workspace with nothing in it has nothing to say yet.
  const relevant = digests.filter((d) => d.next || d.stats.some((s) => s.value > 0))

  const open = (d: WorkspaceDigest, to = d.to) => {
    setScope(d.id)
    navigate(to)
  }

  const needs = [
    { label: 'overdue tasks', count: attention.overdueTasks.length, to: '/tasks' },
    { label: 'follow-ups to chase', count: attention.dueFollowUps.length, to: '/follow-ups' },
    { label: 'meetings to record', count: attention.meetingsToRecord.length, to: '/meetings' },
    { label: 'hearings to write up', count: attention.hearingsToRecord.length, to: '/cases' },
  ].filter((n) => n.count > 0)

  return (
    <>
      <PageHeader eyebrow="All workspaces" title="Overview" description="A little from each part of your work. Open a workspace to go deeper; it keeps the others out of the way." />

      <Section bodyClassName="flex flex-wrap items-center gap-2 p-3">
        {needs.length === 0 ? (
          <span className="flex items-center gap-2 px-1 text-sm text-success">
            <CheckCircle2 className="size-4" /> Nothing is slipping. You’re on top of it.
          </span>
        ) : (
          <>
            <span className="px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Needs you</span>
            {needs.map((n) => (
              <Link key={n.label} to={n.to} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm hover:border-foreground/30 hover:shadow-float">
                <span className="font-semibold text-destructive tabular-nums">{n.count}</span> {n.label}
              </Link>
            ))}
          </>
        )}
      </Section>

      {relevant.length === 0 ? (
        <Section>
          <EmptyState title="Nothing to summarise yet">Add a task, a case or a project and each workspace shows up here.</EmptyState>
        </Section>
      ) : (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
          {relevant.map((d) => (
            <motion.section key={d.id} variants={fadeUp} className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-4 shadow-float backdrop-blur">
              <header className="flex items-center gap-2">
                <WorkspaceDot ws={d.id} className="size-2.5" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{WORKSPACES[d.id].name}</h2>
                  <p className="text-[11px] tracking-widest text-muted-foreground uppercase">{WORKSPACES[d.id].domain}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => open(d)}>
                  Open <ArrowRight />
                </Button>
              </header>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
                {d.stats.map((s) => (
                  <div key={s.label}>
                    <dd className={cn('text-2xl font-semibold tabular-nums', s.tone && TONE[s.tone])}>{s.value}</dd>
                    <dt className="text-[11px] leading-tight text-muted-foreground">{s.label}</dt>
                  </div>
                ))}
              </dl>

              {d.next && (
                <button type="button" onClick={() => open(d, d.next!.to)} className="rounded-xl bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted">
                  <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Next up</div>
                  <div className="truncate text-sm font-medium">{d.next.label}</div>
                  <div className="text-xs text-muted-foreground">{d.next.detail}</div>
                </button>
              )}

              {d.id === 'sb' && <LatestLetters onOpen={() => open(d, '/letters')} />}
            </motion.section>
          ))}
        </motion.div>
      )}
    </>
  )
}

/** The three newest letters in the Drive, if it is connected. */
function LatestLetters({ onOpen }: { onOpen: () => void }) {
  const drive = useDriveStatus()
  const { files } = useDriveSearch('', drive.available, 0)
  if (!drive.available || files.length === 0) return null
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Latest letters</span>
        <button type="button" onClick={onOpen} className="text-xs text-muted-foreground hover:text-foreground">
          See all
        </button>
      </div>
      <ul className="grid gap-0.5">
        {files.slice(0, 3).map((f) => (
          <li key={f.id}>
            <button type="button" onClick={onOpen} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-muted/60">
              <FileTypeIcon kind={fileKind(f.mimeType, f.name)} className="h-6" />
              <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{driveAgo(f.modifiedTime)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
