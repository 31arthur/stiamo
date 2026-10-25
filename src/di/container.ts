import { LocalAuthRepository } from '@/data/auth/LocalAuthRepository'
import { demoSeed } from '@/data/calendar/demoSeed'
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
import {
  GetDayItemsUseCase,
  ReflowDayUseCase,
  RestoreItemsUseCase,
  ScheduleItemUseCase,
  TogglePinUseCase,
  UnscheduleItemUseCase,
} from '@/domain/planner/usecases/PlannerUseCases'

// Composition root: the only place concrete data implementations are wired to domain use cases.
const authRepository = new LocalAuthRepository()
const calendarRepository = new LocalCalendarRepository(localStorage, demoSeed)

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
  planner: {
    getDayItems: new GetDayItemsUseCase(calendarRepository),
    schedule: new ScheduleItemUseCase(calendarRepository),
    unschedule: new UnscheduleItemUseCase(calendarRepository),
    togglePin: new TogglePinUseCase(calendarRepository),
    reflow: new ReflowDayUseCase(calendarRepository),
    restore: new RestoreItemsUseCase(calendarRepository),
  },
}

export type Container = typeof container
