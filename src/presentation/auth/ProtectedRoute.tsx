import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullScreenLoader } from '@/presentation/components/loading'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullScreenLoader label="Signing you in…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
