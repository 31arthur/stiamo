import { useMemo, useState } from 'react'
import { CalendarDays, NotebookPen, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { Command } from '@/components/ui/command'
import { counselLabel } from '@/domain/counsel/Counsel'
import { formatClock } from '@/domain/shared/time'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { KIND_META, MEETING_KIND_ICON } from '@/presentation/components/kinds'
import { Spinner } from '@/components/ui/spinner'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { DriveIcon } from '@/presentation/drive/DriveFinder'
import { driveDate } from '@/presentation/drive/format'
import { useDebounced, useDriveSearch, useDriveStatus } from '@/presentation/drive/useDrive'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { CREATE_MENU } from './createMenu'

/** ⌘K: jump anywhere, create anything, find any record. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const editor = useEditor()
  const today = useToday()
  const { data: cases } = useEntities('case')
  const { data: meetings } = useEntities('meeting')
  const { data: plans } = useEntities('plan')
  const { data: goals } = useEntities('goal')
  const { data: counsel } = useEntities('counsel')
  const { data: clients } = useEntities('client')
  const { data: projects } = useEntities('project')
  const { data: tasks } = useEntities('task')

  const [query, setQuery] = useState('')
  const drive = useDriveStatus()
  const typed = useDebounced(query, 350)
  const letters = useDriveSearch(typed, open && drive.available && typed.trim().length >= 3)
  const lookingInDrive = drive.available && typed.trim().length >= 3

  const change = (next: boolean) => {
    if (!next) setQuery('')
    onOpenChange(next)
  }
  const run = (fn: () => void) => () => {
    change(false)
    fn()
  }

  const pages = useMemo(
    () => [
      { label: 'Today', to: '/today', icon: Sun },
      { label: 'Calendar', to: '/calendar', icon: CalendarDays },
      { label: 'Tasks', to: '/tasks', icon: KIND_META.task.icon },
      { label: 'Follow-ups', to: '/follow-ups', icon: KIND_META.followUp.icon },
      { label: 'Meetings & appointments', to: '/meetings', icon: KIND_META.meeting.icon },
      { label: 'Cases', to: '/cases', icon: KIND_META.case.icon },
      { label: 'Case diary', to: '/diary', icon: NotebookPen },
      { label: 'Counsel', to: '/counsel', icon: KIND_META.counsel.icon },
      { label: 'Clients', to: '/clients', icon: KIND_META.client.icon },
      { label: 'Projects', to: '/projects', icon: KIND_META.project.icon },
      { label: 'Action plans', to: '/plans', icon: KIND_META.plan.icon },
      { label: 'Goals', to: '/goals', icon: KIND_META.goal.icon },
    ],
    [],
  )

  return (
    <CommandDialog open={open} onOpenChange={change} title="Search and commands" className="sm:max-w-xl">
      <Command>
        <CommandInput value={query} onValueChange={setQuery} placeholder={drive.available ? 'Search cases, meetings, tasks, letters in Drive — or type a command…' : 'Search cases, meetings, plans, goals, tasks — or type a command…'} />
        <CommandList className="max-h-[60vh]">
          {/* While searching Drive, that group says for itself whether anything was found. */}
          {!lookingInDrive && <CommandEmpty>Nothing matches.</CommandEmpty>}
          <CommandGroup heading="Create">
            {CREATE_MENU.map((c) => (
              <CommandItem key={c.kind} value={`new ${c.label}`} onSelect={run(() => editor.open({ kind: c.kind } as never))}>
                <c.icon /> New {c.label.toLowerCase()}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Go to">
            {pages.map((p) => (
              <CommandItem key={p.to} value={`go ${p.label}`} onSelect={run(() => navigate(p.to))}>
                <p.icon /> {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Cases">
            {cases.map((c) => (
              <CommandItem key={c.id} value={`case ${c.reference} ${c.courtNumber ?? ''} ${c.title} ${c.client ?? ''} ${c.organization ?? ''}`} onSelect={run(() => navigate(`/cases/${c.id}`))}>
                <KIND_META.case.icon /> <span className="truncate">{c.title}</span>
                <CommandShortcut>{c.reference}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Counsel">
            {counsel.map((c) => (
              <CommandItem key={c.id} value={`counsel ${c.name} ${c.firm ?? ''} ${c.city ?? ''}`} onSelect={run(() => navigate(`/counsel/${c.id}`))}>
                <KIND_META.counsel.icon /> <span className="truncate">{counselLabel(c)}</span>
                {c.city && <CommandShortcut>{c.city}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Clients and projects">
            {clients.map((c) => (
              <CommandItem key={c.id} value={`client ${c.name} ${c.contactName ?? ''}`} onSelect={run(() => navigate(`/clients/${c.id}`))}>
                <KIND_META.client.icon /> <span className="truncate">{c.name}</span>
                {c.contactName && <CommandShortcut>{c.contactName}</CommandShortcut>}
              </CommandItem>
            ))}
            {projects.map((p) => (
              <CommandItem key={p.id} value={`project ${p.title} ${clients.find((c) => c.id === p.clientId)?.name ?? ''}`} onSelect={run(() => navigate(`/projects/${p.id}`))}>
                <KIND_META.project.icon /> <span className="truncate">{p.title}</span>
                <CommandShortcut>{clients.find((c) => c.id === p.clientId)?.name}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Meetings & appointments">
            {meetings.map((m) => {
              const Icon = MEETING_KIND_ICON[m.kind]
              return (
                <CommandItem key={m.id} value={`meeting ${m.title} ${m.counterpart ?? ''}`} onSelect={run(() => navigate(`/meetings/${m.id}`))}>
                  <Icon /> <span className="truncate">{m.title}</span>
                  <CommandShortcut>
                    {friendlyDate(m.slot.date, today)} {formatClock(m.slot.start)}
                  </CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandGroup heading="Action plans & goals">
            {plans.map((p) => (
              <CommandItem key={p.id} value={`plan ${p.title}`} onSelect={run(() => navigate(`/plans/${p.id}`))}>
                <KIND_META.plan.icon /> <span className="truncate">{p.title}</span>
              </CommandItem>
            ))}
            {goals.map((g) => (
              <CommandItem key={g.id} value={`goal ${g.title}`} onSelect={run(() => navigate(`/goals/${g.id}`))}>
                <KIND_META.goal.icon /> <span className="truncate">{g.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {lookingInDrive && (
            <CommandGroup heading="Letters in Drive" forceMount>
              {letters.loading && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Spinner size="xs" tone="current" decorative /> Searching your Drive…
                </div>
              )}
              {letters.error && <div className="px-2 py-1.5 text-xs text-destructive">{letters.error}</div>}
              {!letters.loading && !letters.error && letters.files.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No letter contains all of those words.</div>}
              {letters.files.map((f) => (
                <CommandItem key={f.id} forceMount value={`drive-file ${f.id}`} onSelect={run(() => f.webViewLink && window.open(f.webViewLink, '_blank', 'noopener'))}>
                  <DriveIcon mime={f.mimeType} /> <span className="truncate">{f.name}</span>
                  <CommandShortcut>{driveDate(f.modifiedTime)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Tasks">
            {tasks
              .filter((t) => t.outcome.status === 'open')
              .map((t) => (
                <CommandItem key={t.id} value={`task ${t.title}`} onSelect={run(() => editor.openRef({ kind: 'task', id: t.id }))}>
                  <WorkspaceDot ws={t.workspace} className="mx-1" /> <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
