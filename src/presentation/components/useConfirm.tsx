import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import type { ConfirmOptions } from './ConfirmDialog'

/**
 * `const { confirm, dialog } = useConfirm()`: put `{dialog}` somewhere in the page and `await confirm({...})` where the question
 * is asked. It answers true or false. In place of the browser's alert, which can't be styled and doesn't move.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false)
  // Kept after it closes, so the dialog still has its words while it fades out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const answer = useRef<((yes: boolean) => void) | null>(null)

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        answer.current = resolve
        setOptions(o)
        setOpen(true)
      }),
    [],
  )

  const dialog = (
    <ConfirmDialog
      open={open}
      options={options}
      onAnswer={(yes) => {
        setOpen(false)
        answer.current?.(yes)
        answer.current = null
      }}
    />
  )
  return { confirm, dialog }
}
