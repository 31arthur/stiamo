import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** The message box: grows with what is typed, Enter sends, Shift+Enter starts a new line. */
export function Composer({ value, onChange, onSend, busy, placeholder, footer, className, autoFocus }: { value: string; onChange: (v: string) => void; onSend: () => void; busy?: boolean; placeholder: string; footer?: ReactNode; className?: string; autoFocus?: boolean }) {
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [value])
  useEffect(() => {
    if (autoFocus) box.current?.focus()
  }, [autoFocus])

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (value.trim() && !busy) onSend()
    }
  }

  return (
    <div className={cn('rounded-3xl border bg-background shadow-lift transition-shadow focus-within:shadow-float focus-within:ring-3 focus-within:ring-ring/20', className)}>
      <textarea ref={box} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} rows={1} placeholder={placeholder} aria-label="Message" className="block max-h-[220px] min-h-12 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] outline-none placeholder:text-muted-foreground" />
      <div className="flex items-center gap-2 px-2.5 pb-2.5">
        <div className="min-w-0 flex-1">{footer}</div>
        <Button type="button" size="icon" className="rounded-full" aria-label="Send" disabled={!value.trim() || busy} onClick={onSend}>
          {busy ? <Spinner size="xs" tone="current" decorative /> : <ArrowUp />}
        </Button>
      </div>
    </div>
  )
}
