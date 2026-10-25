import { LocalAuthRepository } from '@/data/auth/LocalAuthRepository'
import { GetCurrentUserUseCase } from '@/domain/auth/usecases/GetCurrentUserUseCase'
import { LoginUseCase } from '@/domain/auth/usecases/LoginUseCase'
import { LogoutUseCase } from '@/domain/auth/usecases/LogoutUseCase'

// Composition root: the only place concrete data implementations are wired to domain use cases.
const authRepository = new LocalAuthRepository()

export const container = {
  auth: {
    login: new LoginUseCase(authRepository),
    logout: new LogoutUseCase(authRepository),
    getCurrentUser: new GetCurrentUserUseCase(authRepository),
  },
}

export type Container = typeof container
