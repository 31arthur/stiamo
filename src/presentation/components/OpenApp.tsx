import type { ComponentProps } from 'react'
import { Link, useResolve } from '@/presentation/routing'
import { useMediaQuery } from '@/presentation/layout/useMediaQuery'

/** A large screen with a mouse: somewhere a second tab is natural. A phone or tablet is not (see `useOpensInNewTab`). */
export const LARGE_SCREEN = '(min-width: 1024px) and (pointer: fine)'

/**
 * Whether the Assistant and Developer open in a tab of their own. On a computer they do, so Stiamo stays where it was and the app sits
 * beside it. On a phone they open in the same tab: a new tab there hides the one you came from behind a tab switcher, and the browser's
 * back gesture would no longer lead home. They are full-screen apps with their own "back to Stiamo", so one tab works well.
 */
export const useOpensInNewTab = () => useMediaQuery(LARGE_SCREEN)

/** A link to the Assistant or Developer: a new tab on a computer, the same tab on a phone. */
export function OpenApp({ to, ...props }: Omit<ComponentProps<typeof Link>, 'target' | 'rel'>) {
  const newTab = useOpensInNewTab()
  const href = useResolve()(to)
  return newTab ? <a href={typeof href === 'string' ? href : undefined} target="_blank" rel="noopener" {...(props as ComponentProps<'a'>)} /> : <Link to={to} {...props} />
}
