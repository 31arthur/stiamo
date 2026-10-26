/**
 * Whether people can create their own accounts. Off by default: accounts are added by the owner
 * (Supabase dashboard → Authentication → Users). Set VITE_ALLOW_SIGNUP=true to show the sign-up form.
 * This only hides the UI; to really block sign-ups, also turn them off in the Supabase dashboard.
 */
export const signUpEnabled = (env: Record<string, string | undefined> = import.meta.env) => env.VITE_ALLOW_SIGNUP === 'true'
