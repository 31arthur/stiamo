import { LocalAuthRepository } from '@/data/auth/LocalAuthRepository'
import { LocalCalendarRepository } from '@/data/calendar/LocalCalendarRepository'
import { GetCurrentUserUseCase } from '@/domain/auth/usecases/GetCurrentUserUseCase'
import { LoginUseCase } from '@/domain/auth/usecases/LoginUseCase'
import { LogoutUseCase } from '@/domain/auth/usecases/LogoutUseCase'
import {
  AddCalendarItemUseCase,
  DeleteCalendarItemUseCase,
  GetMonthViewUseCase,
  ToggleCalendarItemUseCase,
} from '@/domain/calendar/usecases/CalendarUseCases'

// Composition root: the only place concrete data implementations are wired to domain use cases.
const authRepository = new LocalAuthRepository()
const calendarRepository = new LocalCalendarRepository()

export const container = {
  auth: {
    login: new LoginUseCase(authRepository),
    logout: new LogoutUseCase(authRepository),
    getCurrentUser: new GetCurrentUserUseCase(authRepository),
  },
  calendar: {
    getMonthView: new GetMonthViewUseCase(calendarRepository),
    addItem: new AddCalendarItemUseCase(calendarRepository),
    toggleItem: new ToggleCalendarItemUseCase(calendarRepository),
    deleteItem: new DeleteCalendarItemUseCase(calendarRepository),
  },
}

export type Container = typeof container
