import { toast as sonner } from 'sonner'
import type { ExternalToast } from 'sonner'
import { record } from './store'
import type { NoticeLevel } from './store'

type Message = Parameters<typeof sonner>[0]

/** Shows the toast and keeps a copy in the notification drawer. Only plain-text messages are kept; a toast made of components isn't. */
function send(level: NoticeLevel, message: Message, data?: ExternalToast) {
  if (typeof message === 'string') record(level, message, typeof data?.description === 'string' ? data.description : undefined)
  return level === 'info' ? sonner.info(message, data) : sonner[level](message, data)
}

/**
 * The app's one way to tell someone something. It is Sonner's `toast`, so call it the same way, with one addition: everything
 * said is also kept in the notification drawer, so an error that flashed by can be read again.
 */
export const toast = Object.assign((message: Message, data?: ExternalToast) => send('info', message, data), {
  success: (message: Message, data?: ExternalToast) => send('success', message, data),
  error: (message: Message, data?: ExternalToast) => send('error', message, data),
  warning: (message: Message, data?: ExternalToast) => send('warning', message, data),
  info: (message: Message, data?: ExternalToast) => send('info', message, data),
  message: (message: Message, data?: ExternalToast) => send('info', message, data),
  dismiss: sonner.dismiss,
  loading: sonner.loading,
  promise: sonner.promise,
})
