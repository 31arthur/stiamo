import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'
import { readFirebaseConfig } from '@/data/firebase/firebaseApp'
import { firebaseBackend, localBackend } from '@/di/backends'
import { createContainer } from '@/di/container'
import App from './App.tsx'

// Follow the OS colour scheme.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const applyScheme = () => document.documentElement.classList.toggle('dark', darkQuery.matches)
applyScheme()
darkQuery.addEventListener('change', applyScheme)

// Online with Firebase when configured (.env.local), otherwise fully offline on browser storage.
const firebaseConfig = readFirebaseConfig()
const container = createContainer(firebaseConfig ? firebaseBackend(firebaseConfig) : localBackend())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App container={container} />
  </StrictMode>,
)
