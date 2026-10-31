import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'
import { readApiConfig } from '@/data/api/config'
import { readSupabaseConfig } from '@/data/supabase/supabaseClient'
import { localBackend } from '@/di/backends'
import { createContainer } from '@/di/container'
import App from './App.tsx'

// Follow the OS colour scheme.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const applyScheme = () => document.documentElement.classList.toggle('dark', darkQuery.matches)
applyScheme()
darkQuery.addEventListener('change', applyScheme)

// A tab left open across a deploy still points at page files the new build has replaced. When one can't be loaded, fetch the
// current build once (a second failure in a row is a real outage, so it is left alone).
const RELOADED = 'stiamo.chunk-reload'
const reloadForNewBuild = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem(RELOADED, String(Date.now()))
  } catch {
    // Without session storage, reloading could loop: do nothing.
    return
  }
  window.location.reload()
}
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  reloadForNewBuild()
})
window.addEventListener('unhandledrejection', (e) => {
  if (/dynamically imported module|Importing a module script failed/i.test(String(e.reason?.message ?? e.reason))) reloadForNewBuild()
})

// Online with the Stiamo backend when VITE_API_URL is set; else with Supabase when configured (.env.local);
// otherwise fully offline on browser storage. Each is loaded as its own chunk, only when used.
const apiConfig = readApiConfig()
const supabaseConfig = readSupabaseConfig()
const container = apiConfig
  ? (await import('@/di/apiContainer')).createApiContainer(apiConfig)
  : createContainer(supabaseConfig ? (await import('@/di/supabaseBackend')).supabaseBackend(supabaseConfig) : localBackend())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App container={container} />
  </StrictMode>,
)
