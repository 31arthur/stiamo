import { Navigate, useLocation } from 'react-router-dom'
import { canonicalPath } from '@/domain/shared/routes'
import { EditorHost } from '@/presentation/app/create'
import { lastScope, WorkspaceFilterProvider } from '@/presentation/app/workspaceFilter'
import { LiveDataProvider } from '@/presentation/data/live'
import { AppShell } from '@/presentation/layout/AppShell'
import { AssistantShell } from '@/presentation/assistant/AssistantShell'
import { DeveloperShell } from '@/presentation/agents/DeveloperShell'

/**
 * Everything signed-in lives under `/:workspace/…`. An address that isn't quite right (an old bookmark without a
 * workspace, a section under the wrong one, a typo) is redirected to the right one before anything is drawn.
 */
export function WorkspaceShell() {
  const { pathname, search, hash, state } = useLocation()
  const target = canonicalPath(pathname, lastScope())
  if (target !== pathname.replace(/\/+$/, '')) return <Navigate to={{ pathname: target, search, hash }} replace state={state} />
  // The Assistant and the Developer area are apps of their own, each with the whole screen and its own sidebar.
  const section = pathname.split('/').filter(Boolean)[1]
  return (
    <LiveDataProvider>
      <WorkspaceFilterProvider>
        <EditorHost>
          {section === 'assistant' ? <AssistantShell /> : section === 'agents' ? <DeveloperShell /> : <AppShell />}
        </EditorHost>
      </WorkspaceFilterProvider>
    </LiveDataProvider>
  )
}

/** `/`: back to the workspace you were last in. */
export function HomeRedirect() {
  return <Navigate to={canonicalPath('/', lastScope())} replace />
}
