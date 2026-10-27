import { differenceInCalendarDays, parseISO } from 'date-fns'
import { planProgress } from '../plans/ActionPlan'
import type { StepPool } from '../plans/ActionPlan'
import type { Entity, ID, ISODate } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'
import type { Task } from '../tasks/Task'

export type GoalHorizon = 'quarter' | 'half' | 'year' | 'multi_year'
export type GoalStatus = 'active' | 'achieved' | 'dropped'
export type GoalHealth = 'on_track' | 'at_risk' | 'off_track' | 'not_started' | 'achieved' | 'dropped'

export const HORIZON_LABELS: Record<GoalHorizon, string> = {
  quarter: 'Quarter',
  half: 'Half-year',
  year: 'Year',
  multi_year: 'Multi-year',
}

export const HEALTH_LABELS: Record<GoalHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  not_started: 'Not started',
  achieved: 'Achieved',
  dropped: 'Dropped',
}

/** A measurable result that evidences progress on the goal. */
export interface KeyResult {
  id: ID
  label: string
  start: number
  target: number
  current: number
  unit?: string
}

/** A periodic reflection on the goal. */
export interface CheckIn {
  id: ID
  date: ISODate
  /** 1 (won't make it) … 5 (certain). */
  confidence: 1 | 2 | 3 | 4 | 5
  note: string
}

export interface Goal extends Entity {
  title: string
  description: string
  workspace?: WorkspaceId
  horizon: GoalHorizon
  startDate: ISODate
  targetDate: ISODate
  /** Action plans that move this goal forward. A plan may serve several goals. */
  planIds: ID[]
  keyResults: KeyResult[]
  checkIns: CheckIn[]
  status: GoalStatus
}

export const keyResultProgress = (kr: KeyResult) =>
  kr.target === kr.start ? (kr.current >= kr.target ? 1 : 0) : clamp01((kr.current - kr.start) / (kr.target - kr.start))

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export interface GoalProgress {
  /** Blended progress 0..1. */
  progress: number
  /** Average of linked plans' progress, or null without countable plans. */
  plans: number | null
  /** Average key-result progress, or null without key results. */
  keyResults: number | null
  /** Share of the goal's time window that has passed, 0..1. */
  elapsed: number
  health: GoalHealth
  daysLeft: number
}

/**
 * Progress blends key results (outcomes) and linked plans (execution) equally when both exist.
 * Health compares progress with time elapsed: you should be roughly as far along as the calendar is.
 */
export function goalProgress(goal: Goal, tasks: StepPool | Task[], today: ISODate): GoalProgress {
  const planValues = goal.planIds.map((id) => planProgress(id, tasks).progress).filter((p): p is number => p !== null)
  const plans = planValues.length ? avg(planValues) : null
  const keyResults = goal.keyResults.length ? avg(goal.keyResults.map(keyResultProgress)) : null
  const parts = [plans, keyResults].filter((p): p is number => p !== null)
  const progress = parts.length ? avg(parts) : 0

  const span = Math.max(1, differenceInCalendarDays(parseISO(goal.targetDate), parseISO(goal.startDate)))
  const elapsed = clamp01(differenceInCalendarDays(parseISO(today), parseISO(goal.startDate)) / span)
  const daysLeft = differenceInCalendarDays(parseISO(goal.targetDate), parseISO(today))

  return { progress, plans, keyResults, elapsed, health: healthOf(goal, progress, elapsed), daysLeft }
}

function healthOf(goal: Goal, progress: number, elapsed: number): GoalHealth {
  if (goal.status === 'achieved') return 'achieved'
  if (goal.status === 'dropped') return 'dropped'
  if (progress === 0 && elapsed < 0.1) return 'not_started'
  const lag = elapsed - progress
  if (lag <= 0.1) return 'on_track'
  if (lag <= 0.25) return 'at_risk'
  return 'off_track'
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
