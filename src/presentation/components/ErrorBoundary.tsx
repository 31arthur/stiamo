import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  /** What the failed part is called, e.g. "the page editor". */
  what: string
  children: ReactNode
}

/** Keeps one broken part (the editor, a viewer) from taking the whole screen down. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.what} crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="grid justify-items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p>
          <span className="font-medium">Something went wrong with {this.props.what}.</span> Your saved work is safe.
        </p>
        <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    )
  }
}
