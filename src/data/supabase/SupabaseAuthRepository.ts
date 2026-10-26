import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import type { Credentials, Registration, User } from '@/domain/auth/entities/User'
import { InvalidCredentialsError } from '@/domain/auth/errors'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'
import { describeSupabaseError, supabaseCode } from './errors'

const toUser = (u: SupabaseUser): User => ({
  id: u.id,
  name: (u.user_metadata?.name as string | undefined) || u.email?.split('@')[0] || 'You',
  email: u.email ?? '',
})

export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getSession()
    return data.session ? toUser(data.session.user) : null
  }

  async login({ email, password }: Credentials): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (supabaseCode(error) === 'invalid_credentials') throw new InvalidCredentialsError()
      throw new Error(describeSupabaseError(error))
    }
    return toUser(data.user)
  }

  async register({ name, email, password }: Registration): Promise<User> {
    const { data, error } = await this.supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: window.location.origin } })
    if (error) throw new Error(describeSupabaseError(error))
    // With "Confirm email" switched on, no session exists until the link is opened.
    if (!data.session) throw new Error('Almost there — we sent a confirmation link to your email. Open it, then sign in.')
    return toUser(data.session.user)
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) throw new Error(describeSupabaseError(error))
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut()
  }

  onChange(listener: (user: User | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => listener(session ? toUser(session.user) : null))
    return () => data.subscription.unsubscribe()
  }
}
