/**
 * Tells the live views that something was written, so they refetch straight away instead of waiting for the next
 * poll. Several writes in quick succession (one action often makes a handful) cause one refetch.
 */
export class ChangeBus {
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly delayMs = 60) {}

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  touch() {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.listeners.forEach((l) => l())
    }, this.delayMs)
  }
}
