import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

const html = (md: string) => renderToStaticMarkup(<Markdown>{md}</Markdown>)

describe('an agent’s answer', () => {
  it('shows bold, lists and tables as such instead of the symbols', () => {
    const out = html('**Fixed commitments:** none\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    expect(out).toContain('<strong class="font-semibold">Fixed commitments:</strong>')
    expect(out).not.toContain('**')
    expect(out).toContain('<ul')
    expect(out.match(/<li/g)).toHaveLength(2)
    expect(out).toContain('<table')
  })

  it('opens links in a new tab and never runs HTML it was given', () => {
    const out = html('[Docs](https://example.com) <script>alert(1)</script> <img src=x onerror=alert(1)>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
  })
})
