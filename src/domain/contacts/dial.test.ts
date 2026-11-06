import { describe, expect, it } from 'vitest'
import { contactLine, dialHref, emailOf, nameOf, phoneOf } from './dial'

describe('reading who to reach', () => {
  it('finds a number in whatever was typed, and gives the digits a dialer takes', () => {
    expect(phoneOf('Ada Lovelace · +91 98765 43210')).toBe('+919876543210')
    expect(phoneOf('call (080) 2345-6789 after 5')).toBe('08023456789')
    expect(phoneOf('98450 12345')).toBe('9845012345')
    expect(phoneOf('Ada Lovelace')).toBeUndefined()
    expect(phoneOf('room 12')).toBeUndefined()
    expect(phoneOf(undefined)).toBeUndefined()
  })

  it('finds an address and the name that is left', () => {
    expect(emailOf('Ada <ada@labour.gov.in> 98450 12345')).toBe('ada@labour.gov.in')
    expect(nameOf('Ada Lovelace · +91 98765 43210')).toBe('Ada Lovelace')
    expect(nameOf('+91 98765 43210')).toBe('')
    expect(nameOf('Registrar, ada@labour.gov.in')).toBe('Registrar')
    expect(contactLine('Ada Lovelace', '+91 98765 43210')).toBe('Ada Lovelace · +91 98765 43210')
    expect(contactLine('Ada Lovelace')).toBe('Ada Lovelace')
  })

  it('opens the dialer for a call, the messages app for a message, the mail app for an email, and nothing for a visit', () => {
    const line = 'Ada · +91 98765 43210 · ada@labour.gov.in'
    expect(dialHref(line)).toBe('tel:+919876543210')
    expect(dialHref(line, 'call')).toBe('tel:+919876543210')
    expect(dialHref(line, 'message')).toBe('sms:+919876543210')
    expect(dialHref(line, 'email')).toBe('mailto:ada@labour.gov.in')
    expect(dialHref(line, 'visit')).toBeUndefined()
    expect(dialHref('Ada', 'call')).toBeUndefined()
    expect(dialHref('98450 12345', 'email')).toBeUndefined()
  })
})
