import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

/** Phones and small tablets in portrait. */
export const useIsCompact = () => useMediaQuery('(max-width: 639px)')
/** Touch-first devices, where drag needs a long-press so the page can still scroll. */
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)')
