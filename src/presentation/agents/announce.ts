import type { WorkflowRun } from '@/domain/ai/AgentApi'
import { toast } from '@/presentation/notifications/toast'

/** Says what a run or a test did, and (for the notification drawer) what went wrong. A test that worked stays quiet: its result is on screen. */
export function announce(name: string, mode: 'test' | 'run', run: WorkflowRun) {
  const failed = run.items.filter((i) => i.status === 'failed')
  if (failed.length > 0) toast.warning(`${name}: ${failed.length} of ${run.counts.items} item${run.counts.items === 1 ? '' : 's'} couldn’t be decided`, { description: failed[0].error })
  if (mode === 'run') toast.success(`${name} finished`, { description: run.summary })
}

export function announceFailure(name: string, mode: 'test' | 'run', error: unknown) {
  toast.error(`${name}: the ${mode === 'test' ? 'test run' : 'run'} failed`, { description: error instanceof Error ? error.message : 'It didn’t run.' })
}
