import type { Registration, User } from '../entities/User'
import { ValidationError } from '../errors'
import type { AuthRepository } from '../repositories/AuthRepository'
import { EMAIL_PATTERN } from './LoginUseCase'

export const MIN_PASSWORD_LENGTH = 8

export class RegisterUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: Registration): Promise<User> {
    const name = input.name.trim()
    const email = input.email.trim()
    if (!name) throw new ValidationError('Enter your name')
    if (!EMAIL_PATTERN.test(email)) throw new ValidationError('Enter a valid email address')
    if (input.password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password`)
    return this.authRepository.register({ name, email, password: input.password })
  }
}

export class ResetPasswordUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(email: string): Promise<void> {
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) throw new ValidationError('Enter the email you signed up with')
    return this.authRepository.resetPassword(trimmed)
  }
}
