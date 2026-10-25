import { Button } from '@/components/ui/button'
import { useAuth } from '@/presentation/auth/AuthProvider'

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stiamo</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>
    </div>
  )
}
