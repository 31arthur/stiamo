import type { GoalHealth } from '@/domain/goals/Goal'

export const HEALTH_STYLE: Record<GoalHealth, { chip: string; ring: string; bar: string }> = {
  on_track: { chip: 'bg-success/12 text-success', ring: 'stroke-success', bar: 'bg-success' },
  at_risk: { chip: 'bg-warning/15 text-warning', ring: 'stroke-warning', bar: 'bg-warning' },
  off_track: { chip: 'bg-destructive/10 text-destructive', ring: 'stroke-destructive', bar: 'bg-destructive' },
  not_started: { chip: 'bg-muted text-muted-foreground', ring: 'stroke-muted-foreground', bar: 'bg-muted-foreground' },
  achieved: { chip: 'bg-success/12 text-success', ring: 'stroke-success', bar: 'bg-success' },
  dropped: { chip: 'bg-muted text-muted-foreground', ring: 'stroke-muted-foreground', bar: 'bg-muted-foreground' },
}
