export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password')
    this.name = 'InvalidCredentialsError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
