import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

export function usePatch<T>(initial: T) {
  const [value, setValue] = useState<T>(initial)
  const patch = (p: Partial<T>) => setValue((v) => ({ ...v, ...p }))
  return [value, patch, setValue] as const
}

/** Form wrapper: handles submit state, shows validation errors from use cases inline. */
export function FormShell({ onSubmit, submitLabel, onCancel, children, danger }: { onSubmit: () => Promise<unknown>; submitLabel: string; onCancel: () => void; children: ReactNode; danger?: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handle(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSubmit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handle} className="grid gap-4">
      {children}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className="items-center sm:justify-between">
        <div>{danger}</div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

export const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)
