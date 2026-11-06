/**
 * Who to reach, as one line of text: a name and a number ("Ada Lovelace · +91 98765 43210"), or only one of them. These read what is in
 * the line, so what a person typed by hand works the same as what was picked from their contacts.
 */

const PHONE = /\+?\d[\d\s().-]{6,}\d/
const EMAIL = /[\w.+'-]+@[\w-]+(?:\.[\w-]+)+/

/** The first thing that looks like a phone number, as the digits (and a leading +) a dialer takes. */
export const phoneOf = (text?: string): string | undefined => text?.match(PHONE)?.[0].replace(/[\s().-]/g, '')

export const emailOf = (text?: string): string | undefined => text?.match(EMAIL)?.[0]

/** What is left of the line without its number or address: the name. */
export const nameOf = (text?: string): string =>
  (text ?? '')
    .replace(PHONE, '')
    .replace(EMAIL, '')
    .replace(/^[\s·,;:|–—-]+|[\s·,;:|–—-]+$/g, '')
    .trim()

/** A name and a number as one line, the way a picked contact is kept. */
export const contactLine = (name: string, phone?: string): string => (phone ? `${name} · ${phone}` : name)

export type DialChannel = 'call' | 'message' | 'email' | 'visit'

/** What tapping the contact does for this kind of follow-up: the dialer, the messages app, or the mail app. None when there is nothing to open. */
export function dialHref(contact: string | undefined, channel: DialChannel = 'call'): string | undefined {
  const phone = phoneOf(contact)
  if (channel === 'email') {
    const mail = emailOf(contact)
    return mail ? `mailto:${mail}` : undefined
  }
  if (!phone || channel === 'visit') return undefined
  return channel === 'message' ? `sms:${phone}` : `tel:${phone}`
}
