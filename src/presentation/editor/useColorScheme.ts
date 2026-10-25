import { useEffect, useState } from 'react'

/** Tracks the `.dark` class the app sets on <html>. */
export function useColorScheme(): 'light' | 'dark' {
  const read = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const [scheme, setScheme] = useState<'light' | 'dark'>(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setScheme(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return scheme
}
