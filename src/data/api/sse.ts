/** Reads a server-sent-events body. `fetch` is used instead of `EventSource` because that cannot send the Authorization header. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (name: string, data: string) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    let end: number
    while ((end = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '')
      let name = 'message'
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith(':')) continue // a keep-alive comment
        if (line.startsWith('event:')) name = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (data.length) onEvent(name, data.join('\n'))
    }
  }
}
