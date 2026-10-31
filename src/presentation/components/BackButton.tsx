import { ArrowLeft } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from '@/presentation/routing'
import { Button } from '@/components/ui/button'

/**
 * Back to wherever you came from. If this page was opened directly (a bookmark, a shared link, a
 * reload in a new tab) there is no "previous page", so it goes to `fallback` instead.
 */
export function BackButton({ fallback, label = 'Back' }: { fallback: string; label?: string }) {
  const navigate = useNavigate()
  const { key } = useLocation()
  const hasPrevious = key !== 'default'
  return (
    <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => (hasPrevious ? navigate(-1) : navigate(fallback))}>
      <ArrowLeft /> {label}
    </Button>
  )
}
