import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  publishableKey: string
}

/**
 * Reads the project URL and publishable (anon) key from the environment; null means "run offline".
 * Both naming styles work: VITE_SUPABASE_* and NEXT_PUBLIC_SUPABASE_*. The publishable key is
 * designed to ship in the browser — row-level security in the database is what protects the data.
 */
export function readSupabaseConfig(env: Record<string, string | undefined> = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return url && publishableKey ? { url, publishableKey } : null
}

export function createSupabase({ url, publishableKey }: SupabaseConfig): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
}
