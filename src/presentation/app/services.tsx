import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Container } from '@/di/container'

const ServicesContext = createContext<Container | null>(null)

// Data is local and every mutation invalidates, so cached reads never go stale on their own.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } },
})

/** Provides the composition root to the React tree and waits for first-run data. */
export function ServicesProvider({ container, children }: { container: Container; children: ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    container.ready.then(() => setReady(true))
  }, [container])

  return (
    <ServicesContext.Provider value={container}>
      <QueryClientProvider client={queryClient}>{ready ? children : null}</QueryClientProvider>
    </ServicesContext.Provider>
  )
}

export function useServices(): Container {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices must be used within a ServicesProvider')
  return ctx
}
