import { useEffect, useRef, useState } from 'react'
import { Excalidraw, exportToBlob, serializeAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useColorScheme } from './useColorScheme'

export interface DrawingResult {
  scene: string
  png: Blob
}

/** A full-screen Excalidraw canvas. Loaded on demand — it's a large library. */
export default function DrawingDialog({ open, sceneUrl, onSave, onClose }: { open: boolean; sceneUrl?: string; onSave: (r: DrawingResult) => Promise<void>; onClose: () => void }) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const scheme = useColorScheme()
  const [initial, setInitial] = useState<ExcalidrawInitialDataState | null | undefined>(sceneUrl ? undefined : null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !sceneUrl) return
    let active = true
    fetch(sceneUrl)
      .then((r) => r.json())
      .then((data: ExcalidrawInitialDataState) => active && setInitial({ ...data, scrollToContent: true }))
      .catch(() => active && setInitial(null))
    return () => {
      active = false
    }
  }, [open, sceneUrl])

  async function save() {
    const a = api.current
    if (!a) return
    setSaving(true)
    try {
      const elements = a.getSceneElements()
      const appState = a.getAppState()
      const files = a.getFiles()
      const png = await exportToBlob({ elements, appState: { ...appState, exportBackground: true, exportWithDarkMode: false }, files, mimeType: 'image/png', exportPadding: 24 })
      await onSave({ scene: serializeAsJSON(elements, appState, files, 'local'), png })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:w-[96vw] sm:max-w-none sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-medium">Drawing</DialogTitle>
            <DialogDescription className="text-xs">Sketch, diagram, annotate — saved into the plan page</DialogDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={initial === undefined} loading={saving}>
            Save drawing
          </Button>
        </header>
        <div className="relative min-h-0 flex-1">
          {initial === undefined ? (
            <div className="flex size-full items-center justify-center">
              <Spinner label="Opening the drawing" />
            </div>
          ) : (
            <Excalidraw excalidrawAPI={(x) => (api.current = x)} initialData={initial} theme={scheme} UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
