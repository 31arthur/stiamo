import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Credentials, User } from '@/domain/auth/entities/User'
import type { Container } from '@/di/container'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  auth: Container['auth']
  children: ReactNode
}

export function AuthProvider({ auth, children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    auth.getCurrentUser
      .execute()
      .then((current) => active && setUser(current))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [auth])

  const login = useCallback(
    async (credentials: Credentials) => setUser(await auth.login.execute(credentials)),
    [auth],
  )

  const logout = useCallback(async () => {
    await auth.logout.execute()
    setUser(null)
  }, [auth])

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
