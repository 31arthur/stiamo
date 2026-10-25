import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Credentials, Registration, User } from '@/domain/auth/entities/User'
import type { Container } from '@/di/container'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (registration: Registration) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ auth, children }: { auth: Container['auth']; children: ReactNode }) {
  const client = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    auth.getCurrentUser
      .execute()
      .then((current) => active && setUser(current))
      .finally(() => active && setIsLoading(false))
    // Follow session changes made elsewhere (another tab, token expiry).
    const unsubscribe = auth.onChange((next) => active && setUser(next))
    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  // Never show one account's cached data to another.
  useEffect(() => {
    if (!user) client.clear()
  }, [user, client])

  const login = useCallback(async (c: Credentials) => setUser(await auth.login.execute(c)), [auth])
  const register = useCallback(async (r: Registration) => setUser(await auth.register.execute(r)), [auth])
  const resetPassword = useCallback((email: string) => auth.resetPassword.execute(email), [auth])
  const logout = useCallback(async () => {
    await auth.logout.execute()
    setUser(null)
  }, [auth])

  const value = useMemo(() => ({ user, isLoading, login, register, resetPassword, logout }), [user, isLoading, login, register, resetPassword, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
