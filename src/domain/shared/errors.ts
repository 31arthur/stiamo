export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`)
    this.name = 'NotFoundError'
  }
}

export function required(value: string | undefined, field: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) throw new ValidationError(`${field} is required`)
  return trimmed
}
