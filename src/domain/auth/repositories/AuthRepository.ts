import type { Credentials, User } from '../entities/User'

export interface AuthRepository {
  getCurrentUser(): Promise<User | null>
  login(credentials: Credentials): Promise<User>
  logout(): Promise<void>
}
