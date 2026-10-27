import { SupabaseFileStore } from '@/data/files/SupabaseFileStore'
import { SupabaseAuthRepository } from '@/data/supabase/SupabaseAuthRepository'
import { createSupabase } from '@/data/supabase/supabaseClient'
import type { SupabaseConfig } from '@/data/supabase/supabaseClient'
import { SupabaseRepository } from '@/data/supabase/SupabaseRepository'
import { systemClock, uuidGenerator } from '@/data/storage/system'
import type { Repositories } from '@/domain/shared/registry'
import type { Backend } from './backends'
import { signUpEnabled } from './flags'

/** Postgres table behind each collection. */
export const TABLES: Record<keyof Repositories, string> = {
  task: 'tasks',
  meeting: 'meetings',
  followUp: 'follow_ups',
  case: 'cases',
  hearing: 'hearings',
  plan: 'plans',
  goal: 'goals',
  counsel: 'counsel',
  client: 'clients',
  project: 'projects',
  link: 'links',
  activity: 'activity',
  attachment: 'attachments',
}

// Kept apart from backends.ts so the Supabase client loads as its own chunk, only when configured.
export function supabaseBackend(config: SupabaseConfig): Backend {
  const supabase = createSupabase(config)
  const repo = <K extends keyof Repositories>(k: K) => new SupabaseRepository(supabase, TABLES[k]) as unknown as Repositories[K]
  return {
    kind: 'supabase',
    auth: new SupabaseAuthRepository(supabase),
    repos: {
      task: repo('task'),
      meeting: repo('meeting'),
      followUp: repo('followUp'),
      case: repo('case'),
      hearing: repo('hearing'),
      plan: repo('plan'),
      goal: repo('goal'),
      counsel: repo('counsel'),
      client: repo('client'),
      project: repo('project'),
      link: repo('link'),
      activity: repo('activity'),
      attachment: repo('attachment'),
    },
    files: new SupabaseFileStore(supabase),
    allowSignUp: signUpEnabled(),
    clock: systemClock,
    ids: uuidGenerator,
  }
}
