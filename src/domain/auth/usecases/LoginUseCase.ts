import type { Credentials, User } from '../entities/User'
import { ValidationError } from '../errors'
import type { AuthRepository } from '../repositories/AuthRepository'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class LoginUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(credentials: Credentials): Promise<User> {
    const email = credentials.email.trim()
    if (!EMAIL_PATTERN.test(email)) throw new ValidationError('Enter a valid email address')
    if (!credentials.password) throw new ValidationError('Enter your password')
    return this.authRepository.login({ email, password: credentials.password })
  }
}
