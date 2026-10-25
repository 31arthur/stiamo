import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Hearing, LegalCase } from '@/domain/cases/LegalCase'
import type { FollowUp } from '@/domain/followups/FollowUp'
import type { Goal } from '@/domain/goals/Goal'
import type { Meeting } from '@/domain/meetings/Meeting'
import type { ActionPlan } from '@/domain/plans/ActionPlan'
import type { EntityRef } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/Task'
import { useServices } from '@/presentation/app/services'
import { useToday, useUserId } from '@/presentation/data/hooks'
import { CaseForm, HearingForm, newCase } from '@/presentation/forms/CaseForms'
import type { CaseDraft, HearingDraft } from '@/presentation/forms/CaseForms'
import { FollowUpForm, newFollowUp } from '@/presentation/forms/FollowUpForm'
import type { FollowUpDraft } from '@/presentation/forms/FollowUpForm'
import { GoalForm, newGoal } from '@/presentation/forms/GoalForm'
import type { GoalDraft } from '@/presentation/forms/GoalForm'
import { MeetingForm, newMeeting } from '@/presentation/forms/MeetingForm'
import type { MeetingDraft } from '@/presentation/forms/MeetingForm'
import { newPlan, PlanForm } from '@/presentation/forms/PlanForm'
import type { PlanDraft, PlanFormExtras } from '@/presentation/forms/PlanForm'
import { newTask, TaskForm } from '@/presentation/forms/TaskForm'
import type { TaskDraft } from '@/presentation/forms/TaskForm'
import { RecordSheet } from './RecordSheet'
import { useWorkspaceFilter } from './workspaceFilter'

export type EditorRequest =
  | { kind: 'task'; value?: Task | Partial<TaskDraft> }
  | { kind: 'followUp'; value?: FollowUp | Partial<FollowUpDraft> }
  | { kind: 'appointment' | 'meeting'; value?: Meeting | Partial<MeetingDraft> }
  | { kind: 'case'; value?: LegalCase | Partial<CaseDraft> }
  | { kind: 'hearing'; value: Hearing | HearingDraft }
  | { kind: 'plan'; value?: ActionPlan | Partial<PlanDraft>; extras?: PlanFormExtras }
  | { kind: 'goal'; value?: Goal | Partial<GoalDraft> }

export type EditorKind = EditorRequest['kind']

const TITLES: Record<EditorKind, [create: string, edit: string, description: string]> = {
  task: ['New task', 'Edit task', 'Personal, S&B, FSA or media work'],
  followUp: ['New follow-up', 'Edit follow-up', 'A call, message, email or visit to make'],
  appointment: ['New appointment', 'Edit appointment', 'With a client or outside party'],
  meeting: ['New meeting', 'Edit meeting', 'An agenda-driven discussion'],
  case: ['Open a case', 'Edit case', 'S&B Consultants matter'],
  hearing: ['List a hearing', 'Edit hearing', 'A date before the court'],
  plan: ['New action plan', 'Edit action plan', 'Steps towards an objective'],
  goal: ['Set a goal', 'Edit goal', 'Something to achieve over time'],
}

interface EditorApi {
  open: (request: EditorRequest) => void
  /** Opens the right place for a record: its page, or its editor for tasks and follow-ups. */
  openRef: (ref: EntityRef) => void
}

const Ctx = createContext<EditorApi | null>(null)

/** Hosts every create/edit dialog so any screen (or the command palette) can open one. */
export function EditorHost({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<EditorRequest | null>(null)
  const [sheet, setSheet] = useState<EntityRef | null>(null)
  const navigate = useNavigate()
  const today = useToday()
  const userId = useUserId()
  const services = useServices()
  const { scope } = useWorkspaceFilter()
  const workspace = scope === 'all' ? undefined : scope

  const close = useCallback(() => setRequest(null), [])

  const openRef = useCallback(
    async (ref: EntityRef) => {
      switch (ref.kind) {
        case 'task':
        case 'followUp':
          return setSheet(ref)
        case 'hearing': {
          const h = await services.crud.hearing.get(userId, ref.id)
          if (h) navigate(`/cases/${h.caseId}`)
          break
        }
        case 'meeting':
          return navigate(`/meetings/${ref.id}`)
        case 'case':
          return navigate(`/cases/${ref.id}`)
        case 'plan':
          return navigate(`/plans/${ref.id}`)
        case 'goal':
          return navigate(`/goals/${ref.id}`)
      }
    },
    [navigate, services, userId],
  )

  // Opening is deferred a frame: when triggered from a menu item, the menu's own close (and the
  // tail of that pointer gesture) would otherwise land on the new dialog and dismiss it.
  const open = useCallback((r: EditorRequest) => requestAnimationFrame(() => setRequest(r)), [])
  const api = useMemo(() => ({ open, openRef }), [open, openRef])
  const editing = !!request?.value && 'createdAt' in request.value
  const [createTitle, editTitle, description] = request ? TITLES[request.kind] : ['', '', '']

  const done = (path?: string) => (saved?: { id: string }) => {
    close()
    if (saved && !editing && path) navigate(`${path}/${saved.id}`)
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <RecordSheet refTo={sheet} onClose={() => setSheet(null)} onEdit={setRequest} />
      <Dialog open={request !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal tracking-tight">{editing ? editTitle : createTitle}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {request?.kind === 'task' && (
            <TaskForm initial={editing ? (request.value as Task) : newTask({ workspace, ...request.value })} onDone={done()} />
          )}
          {request?.kind === 'followUp' && (
            <FollowUpForm initial={editing ? (request.value as FollowUp) : newFollowUp(today, { workspace, ...request.value })} onDone={done()} />
          )}
          {(request?.kind === 'appointment' || request?.kind === 'meeting') && (
            <MeetingForm
              initial={editing ? (request.value as Meeting) : newMeeting(request.kind, today, { ...(workspace && { workspace }), ...request.value })}
              onDone={done('/meetings')}
            />
          )}
          {request?.kind === 'case' && <CaseForm initial={editing ? (request.value as LegalCase) : { ...newCase(), ...request.value }} onDone={done('/cases')} />}
          {request?.kind === 'hearing' && <HearingForm initial={request.value} onDone={done()} />}
          {request?.kind === 'plan' && (
            <PlanForm
              initial={editing ? (request.value as ActionPlan) : newPlan({ ...(workspace && { workspace }), ...request.value })}
              extras={request.extras}
              onDone={done('/plans')}
            />
          )}
          {request?.kind === 'goal' && (
            <GoalForm initial={editing ? (request.value as Goal) : { ...newGoal(today), workspace, ...request.value }} onDone={done('/goals')} />
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

export function useEditor(): EditorApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEditor must be used within EditorHost')
  return ctx
}
