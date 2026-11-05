/** What was typed on the start screen, waiting for its new chat to open and send it. Held for the moment between the two screens. */
const FIRST = new Map<string, string>()

export const holdFirstMessage = (chatId: string, message: string) => void FIRST.set(chatId, message)

export function takeFirstMessage(chatId: string): string | undefined {
  const m = FIRST.get(chatId)
  FIRST.delete(chatId)
  return m
}
