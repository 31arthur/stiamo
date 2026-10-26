import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Accept the NEXT_PUBLIC_ names Supabase's dashboard hands out, as well as VITE_.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
