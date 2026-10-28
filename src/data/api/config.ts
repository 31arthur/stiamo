export interface ApiConfig {
  /** Where the Stiamo backend lives, without a trailing slash: https://stiamo-be.example.com */
  baseUrl: string
}

/** Reads the backend address from the environment; null means "not configured" (fall back to the other backends). */
export function readApiConfig(env: Record<string, string | undefined> = import.meta.env): ApiConfig | null {
  const url = env.VITE_API_URL?.trim()
  return url ? { baseUrl: url.replace(/\/+$/, '') } : null
}
