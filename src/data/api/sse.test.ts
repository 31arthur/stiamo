import { describe, expect, it } from 'vitest'
import { readEvents } from './sse'

const stream = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk))
      c.close()
    },
  })

describe('readEvents', () => {
  it('reads named events and skips keep-alives, even when a chunk ends mid-event', async () => {
    const seen: [string, string][] = []
    await readEvents(stream('retry: 5000\n\n', ': keep-alive\n\nevent: state\ndata: {"a"', ':1}\n\nevent: changed\ndata: {}\n\n'), (n, d) => seen.push([n, d]))
    expect(seen).toEqual([
      ['state', '{"a":1}'],
      ['changed', '{}'],
    ])
  })
})
