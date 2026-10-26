interface SupabaseLikeError {
  message?: string
  code?: string
  status?: number
  statusCode?: string | number
  error?: string
}

const BY_CODE: Record<string, string> = {
  // Auth
  invalid_credentials: 'Invalid email or password',
  user_already_exists: 'An account with this email already exists — sign in instead',
  email_exists: 'An account with this email already exists — sign in instead',
  weak_password: 'Choose a stronger password (at least 8 characters)',
  email_not_confirmed: 'Confirm your email first — check your inbox for the link we sent',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again',
  signup_disabled: 'Sign-ups are turned off for this project (Authentication → Sign In / Providers)',
  email_provider_disabled: 'Email sign-in is turned off for this project (Authentication → Sign In / Providers)',
  validation_failed: 'Enter a valid email address',
  // Database (PostgREST / Postgres)
  PGRST205: 'The database tables haven’t been created yet. Run supabase/migrations/0001_init.sql in the Supabase SQL Editor',
  '42P01': 'The database tables haven’t been created yet. Run supabase/migrations/0001_init.sql in the Supabase SQL Editor',
  '42501': 'You don’t have access to this data. Check that row-level security policies from the migration are in place',
  PGRST301: 'Your session has expired — sign in again',
  PGRST303: 'Your session has expired — sign in again',
}

/** Turns Supabase errors into sentences a person can act on. */
export function describeSupabaseError(error: unknown): string {
  if (typeof error === 'string') return error
  const e = error as SupabaseLikeError | null
  if (e?.code && BY_CODE[e.code]) return BY_CODE[e.code]
  const message = e?.message ?? ''
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'You appear to be offline — changes will sync when you’re back'
  if (/bucket not found/i.test(message)) return 'The “attachments” storage bucket doesn’t exist yet. Run supabase/migrations/0001_init.sql'
  if (/row-level security|violates row/i.test(message)) return 'You don’t have access to this data. Check that the migration’s security policies are in place'
  if (/jwt expired/i.test(message)) return 'Your session has expired — sign in again'
  return message || 'Something went wrong'
}

export const supabaseCode = (error: unknown) => (error as SupabaseLikeError | null)?.code
