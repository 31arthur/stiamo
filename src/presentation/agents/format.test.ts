import { describe, expect, it } from 'vitest'
import { money } from './format'

describe('money', () => {
  it('shows a fraction of a cent, and "—" when nobody says what it cost', () => {
    expect(money(null)).toBe('—')
    expect(money(undefined)).toBe('—')
    expect(money(0)).toBe('$0')
    expect(money(0.00088)).toBe('$0.00088')
    expect(money(0.0421)).toBe('$0.042')
    expect(money(12.3456)).toBe('$12.35')
  })
})
