import type { LucideIcon } from 'lucide-react'
import type { EditorKind } from '@/presentation/app/create'
import { KIND_META, MEETING_KIND_ICON } from '@/presentation/components/kinds'

export const CREATE_MENU: { kind: EditorKind; label: string; icon: LucideIcon }[] = [
  { kind: 'task', label: 'Task', icon: KIND_META.task.icon },
  { kind: 'followUp', label: 'Follow-up', icon: KIND_META.followUp.icon },
  { kind: 'appointment', label: 'Appointment', icon: MEETING_KIND_ICON.appointment },
  { kind: 'meeting', label: 'Meeting', icon: MEETING_KIND_ICON.meeting },
  { kind: 'case', label: 'Case', icon: KIND_META.case.icon },
  { kind: 'plan', label: 'Action plan', icon: KIND_META.plan.icon },
  { kind: 'goal', label: 'Goal', icon: KIND_META.goal.icon },
  { kind: 'counsel', label: 'Counsel (advocate / firm)', icon: KIND_META.counsel.icon },
]
