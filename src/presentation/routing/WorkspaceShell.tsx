import { Navigate, useLocation } from 'react-router-dom'
import { canonicalPath } from '@/domain/shared/routes'
import { EditorHost } from '@/presentation/app/create'
import { lastScope, WorkspaceFilterProvider } from '@/presentation/app/workspaceFilter'
import { LiveDataProvider } from '@/presentation/data/live'
import { AppShell } from '@/presentation/layout/AppShell'

/**
 * Everything signed-in lives under `/:workspace/…`. An address that isn't quite right (an old bookmark without a
 * workspace, a section under the wrong one, a typo) is redirected to the right one before anything is drawn.
 */
export function WorkspaceShell() {
  const { pathname, search, hash, state } = useLocation()
  const target = canonicalPath(pathname, lastScope())
  if (target !== pathname.replace(/\/+$/, '')) return <Navigate to={{ pathname: target, search, hash }} replace state={state} />
  return (
    <LiveDataProvider>
      <WorkspaceFilterProvider>
        <EditorHost>
          <AppShell />
        </EditorHost>
      </WorkspaceFilterProvider>
    </LiveDataProvider>
  )
}

/** `/`: back to the workspace you were last in. */
export function HomeRedirect() {
  return <Navigate to={canonicalPath('/', lastScope())} replace />
}
