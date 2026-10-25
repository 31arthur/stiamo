import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
