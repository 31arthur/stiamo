import { forwardRef, useCallback } from 'react'
import type { ComponentProps } from 'react'
import { Link as RouterLink, NavLink as RouterNavLink, Navigate as RouterNavigate, useNavigate as useRouterNavigate } from 'react-router-dom'
import type { NavigateOptions, To } from 'react-router-dom'
import { resolveLink } from '@/domain/shared/routes'
import { useScope } from '@/presentation/app/workspaceFilter'

/**
 * Links, redirects and navigation written the short way (`/cases/1`) that resolve to the real address under the
 * workspace you are in (`/sb/cases/1`). Use these instead of react-router's own inside the signed-in app.
 */
function useResolve() {
  const scope = useScope()
  return useCallback((to: To): To => (typeof to === 'string' ? resolveLink(to, scope) : to.pathname ? { ...to, pathname: resolveLink(to.pathname, scope) } : to), [scope])
}

export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof RouterLink>>(function Link({ to, ...props }, ref) {
  return <RouterLink ref={ref} to={useResolve()(to)} {...props} />
})

export const NavLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof RouterNavLink>>(function NavLink({ to, ...props }, ref) {
  return <RouterNavLink ref={ref} to={useResolve()(to)} {...props} />
})

export function Navigate({ to, ...props }: ComponentProps<typeof RouterNavigate>) {
  return <RouterNavigate to={useResolve()(to)} {...props} />
}

export function useNavigate() {
  const navigate = useRouterNavigate()
  const resolve = useResolve()
  return useCallback((to: To | number, options?: NavigateOptions) => (typeof to === 'number' ? navigate(to) : navigate(resolve(to), options)), [navigate, resolve])
}
